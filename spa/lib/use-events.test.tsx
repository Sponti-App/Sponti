import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Real builds must never show made-up flares (#92): demo data comes only from
// the `seedDemoData` flag, never as a fallback for a failed or missing api.

const fetchMapEvents = vi.hoisted(() => vi.fn())
const fetchCalendarEvents = vi.hoisted(() => vi.fn())

vi.mock("./api/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api/events")>()),
  fetchMapEvents,
  fetchCalendarEvents,
}))

const COORDS = { lat: 41.39, lng: 2.17 }

// DEMO_MODE and API_BASE are read at module load, so each case stubs the env
// and imports a fresh copy of the hook module.
async function loadHooks(env: { apiBase?: string; seedDemoData?: string }) {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", env.apiBase ?? "")
  vi.stubEnv("NEXT_PUBLIC_SEED_DEMO_DATA", env.seedDemoData ?? "")
  vi.resetModules()
  const hooks = await import("./use-events")
  const { MOCK_EVENTS } = await import("./api/events")
  return { ...hooks, MOCK_EVENTS }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("use-events data source", () => {
  it("shows an error, not demo flares, when the map fetch fails", async () => {
    fetchMapEvents.mockRejectedValue(new Error("network down"))
    const { useMapEvents } = await loadHooks({ apiBase: "https://api.test" })

    const { result } = renderHook(() => useMapEvents(COORDS, 10))

    await waitFor(() => expect(result.current.error).toBe("network down"))
    expect(result.current.events).toEqual([])
  })

  it("shows an error, not demo events, when the calendar fetch fails", async () => {
    fetchCalendarEvents.mockRejectedValue(new Error("network down"))
    const { useCalendarEvents } = await loadHooks({
      apiBase: "https://api.test",
    })

    const { result } = renderHook(() => useCalendarEvents())

    await waitFor(() => expect(result.current.error).toBe("network down"))
    expect(result.current.events).toEqual([])
  })

  it("reports an unconfigured api instead of falling back to demo data", async () => {
    const { useMapEvents, useCalendarEvents, API_NOT_CONFIGURED_ERROR } =
      await loadHooks({})

    const map = renderHook(() => useMapEvents(COORDS, 10))
    const calendar = renderHook(() => useCalendarEvents())

    expect(map.result.current.error).toBe(API_NOT_CONFIGURED_ERROR)
    expect(map.result.current.events).toEqual([])
    expect(calendar.result.current.error).toBe(API_NOT_CONFIGURED_ERROR)
    expect(calendar.result.current.events).toEqual([])
    expect(fetchMapEvents).not.toHaveBeenCalled()
    expect(fetchCalendarEvents).not.toHaveBeenCalled()
  })

  it("serves demo data only when seedDemoData is on, even with an api configured", async () => {
    const { useMapEvents, useCalendarEvents, MOCK_EVENTS } = await loadHooks({
      apiBase: "https://api.test",
      seedDemoData: "true",
    })

    const map = renderHook(() => useMapEvents(COORDS, 10))
    const calendar = renderHook(() => useCalendarEvents())

    expect(map.result.current.events.length).toBeGreaterThan(0)
    expect(map.result.current.error).toBeNull()
    expect(calendar.result.current.events).toEqual(MOCK_EVENTS)
    expect(fetchMapEvents).not.toHaveBeenCalled()
    expect(fetchCalendarEvents).not.toHaveBeenCalled()
  })
})

// #197: the host was seeing "0 going" with the rsvp already in their feed,
// stuck until a manual refresh or navigation. Map/calendar/my-flares now
// refetch when the tab/app regains focus (via the shared useRefetchOnFocus
// hook), not just on the 60s staleness check or a local emitEventsChanged.
describe("use-events refetch on focus", () => {
  it("refetches map events when the window regains focus", async () => {
    fetchMapEvents.mockResolvedValue([])
    const { useMapEvents } = await loadHooks({ apiBase: "https://api.test" })

    renderHook(() => useMapEvents(COORDS, 10))
    await waitFor(() => expect(fetchMapEvents).toHaveBeenCalledTimes(1))

    window.dispatchEvent(new Event("focus"))

    await waitFor(() => expect(fetchMapEvents).toHaveBeenCalledTimes(2))
  })

  it("refetches calendar events on visibilitychange while visible", async () => {
    fetchCalendarEvents.mockResolvedValue({ items: [] })
    const { useCalendarEvents } = await loadHooks({
      apiBase: "https://api.test",
    })

    renderHook(() => useCalendarEvents())
    await waitFor(() => expect(fetchCalendarEvents).toHaveBeenCalledTimes(1))

    document.dispatchEvent(new Event("visibilitychange"))

    await waitFor(() => expect(fetchCalendarEvents).toHaveBeenCalledTimes(2))
  })
})
