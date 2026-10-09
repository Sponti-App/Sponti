import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EventItem, EventType } from "@/lib/api/events"
import type { FlareIdea } from "@/lib/flare-ideas"
import type { AnywhereIdea } from "@/lib/flare-ideas-anywhere"
import { EVENT_TYPES } from "@/types/utils"

const mocks = vi.hoisted(() => ({
  openDrawer: vi.fn(),
  geo: {
    coords: null as { lat: number; lng: number } | null,
    lastKnownCoords: null as { lat: number; lng: number } | null,
    accuracyMeters: null,
    status: "granted",
    errorMessage: null,
    request: vi.fn(),
    recenter: vi.fn(),
  },
  events: [] as EventItem[],
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "me" }, status: "authenticated" }),
}))
vi.mock("@/components/new-event-drawer-provider", () => ({
  useNewEventDrawer: () => ({
    open: false,
    openDrawer: mocks.openDrawer,
    closeDrawer: vi.fn(),
  }),
}))
vi.mock("@/lib/geolocation", () => ({ useGeolocation: () => mocks.geo }))
vi.mock("@/lib/use-events", () => ({
  useMapEvents: () => ({
    events: mocks.events,
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(),
  }),
}))
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

import { MapView, QuietFlareCard, ideaPrefill, quietIdea } from "./map-view"

// Humboldthain, in the middle of berlin, and a point in san francisco.
const BERLIN = { lat: 52.5474, lng: 13.3873 }
const SAN_FRANCISCO = { lat: 37.7749, lng: -122.4194 }
// The rose garden's season (06-01 to 07-15) is open.
const JUNE = Date.parse("2026-06-15T12:00:00.000Z")

const hangout = EVENT_TYPES.find((t) => t.value === "hangout")!
const food = EVENT_TYPES.find((t) => t.value === "food")!

const roseGarden: FlareIdea = {
  id: "humboldthain-rose-garden",
  title: "roses are blooming at humboldthain",
  category: "hangout",
  place: {
    name: "Humboldthain Rosengarten",
    lat: 52.5474434,
    lng: 13.3872879,
  },
}

describe("quietIdea", () => {
  it("is the nearest idea of the type within 2 km of the centre", () => {
    expect(quietIdea(BERLIN, "hangout", JUNE)?.id).toBe(
      "humboldthain-rose-garden"
    )
  })

  it("is null with no idea of that type in range (outside berlin)", () => {
    expect(quietIdea(SAN_FRANCISCO, "hangout", JUNE)).toBeNull()
  })

  it("is null when the position is unknown", () => {
    expect(quietIdea(null, "hangout", JUNE)).toBeNull()
  })

  it("is null until the map has a clock reading", () => {
    expect(quietIdea(BERLIN, "hangout", 0)).toBeNull()
  })

  it("gives the same idea for the same inputs", () => {
    expect(quietIdea(BERLIN, "food", JUNE)).toBe(
      quietIdea({ ...BERLIN }, "food", JUNE)
    )
  })
})

describe("ideaPrefill", () => {
  it("carries the idea's title, category and place as a picked place", () => {
    expect(ideaPrefill(roseGarden)).toEqual({
      title: "roses are blooming at humboldthain",
      category: "hangout",
      place: {
        source: "place",
        name: "Humboldthain Rosengarten",
        address: undefined,
        coordinates: [13.3872879, 52.5474434],
      },
    })
  })
})

const sofa: AnywhereIdea = {
  id: "anywhere-sofa-no-plans",
  title: "two friends, one sofa, zero plans",
  blurb: "the best plan has no steps",
  category: "hangout",
}

describe("ideaPrefill, place-less (#515)", () => {
  it("carries the title and category and no place, so the composer keeps 'my location'", () => {
    expect(ideaPrefill(sofa)).toEqual({
      title: "two friends, one sofa, zero plans",
      category: "hangout",
    })
    expect(ideaPrefill(sofa)).not.toHaveProperty("place")
  })
})

describe("QuietFlareCard, place-less idea (#515)", () => {
  it("shows no place name or distance, says where it happens and lights with no place", async () => {
    const onLight = vi.fn()
    render(
      <QuietFlareCard
        type={hangout}
        idea={sofa}
        center={BERLIN}
        onLight={onLight}
      />
    )

    expect(
      screen.getByText("two friends, one sofa, zero plans")
    ).toBeInTheDocument()
    expect(
      screen.getByText(/at your place or wherever you are/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/ km| m$/)).not.toBeInTheDocument()
    expect(screen.getByText("idea")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "light a flare" }))
    expect(onLight).toHaveBeenCalledWith({
      title: "two friends, one sofa, zero plans",
      category: "hangout",
    })
  })
})

describe("QuietFlareCard", () => {
  it("idea: shows the idea, a muted idea tag and one peach CTA that lights it", async () => {
    const onLight = vi.fn()
    render(
      <QuietFlareCard
        type={hangout}
        idea={roseGarden}
        center={BERLIN}
        onLight={onLight}
      />
    )

    expect(
      screen.getByText("roses are blooming at humboldthain")
    ).toBeInTheDocument()
    expect(screen.getByText(/Humboldthain Rosengarten/)).toBeInTheDocument()
    const tag = screen.getByText("idea")
    expect(tag).toHaveClass("bg-muted", "text-muted-foreground")
    expect(tag.className).not.toContain("accent")
    expect(screen.getAllByRole("button")).toHaveLength(1)
    const cta = screen.getByRole("button", { name: "light a flare" })
    expect(cta).toHaveClass("bg-accent")

    await userEvent.click(cta)
    expect(onLight).toHaveBeenCalledTimes(1)
    expect(onLight).toHaveBeenCalledWith(ideaPrefill(roseGarden))
  })

  it("generic, no idea in range: the type card, opening the composer with the category", async () => {
    const onLight = vi.fn()
    render(
      <QuietFlareCard
        type={food}
        idea={null}
        center={SAN_FRANCISCO}
        onLight={onLight}
      />
    )

    expect(screen.getByText("up for food?")).toBeInTheDocument()
    expect(screen.queryByText("idea")).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "light a food flare" })
    )
    expect(onLight).toHaveBeenCalledWith({ category: "food" })
  })

  it("generic, no location: the same type card and the same category prefill", async () => {
    const onLight = vi.fn()
    render(
      <QuietFlareCard
        type={food}
        idea={quietIdea(null, "food", JUNE)}
        center={null}
        onLight={onLight}
      />
    )

    expect(screen.getByText("up for food?")).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "light a food flare" })
    )
    expect(onLight).toHaveBeenCalledWith({ category: "food" })
  })
})

// The card as the map wires it: the selected chip, the position the map
// treats as "near me", the map's clock, and the composer.
describe("MapView quiet card", () => {
  beforeEach(() => {
    // jsdom has none; the dock reads its own height with one.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(JUNE)
    mocks.openDrawer.mockClear()
    mocks.events = []
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    mocks.geo.coords = null
    mocks.geo.lastKnownCoords = null
    localStorage.clear()
  })

  const chip = (type: EventType) =>
    screen.getByRole("button", {
      name: EVENT_TYPES.find((t) => t.value === type)!.label,
    })

  const renderMap = () =>
    render(
      <MapView
        onEventSelect={vi.fn()}
        activeRoute={null}
        joinedIds={new Set()}
      />
    )

  it("berlin: an idea card whose CTA opens the composer with the idea's data", async () => {
    mocks.geo.coords = BERLIN
    renderMap()
    await userEvent.click(chip("hangout"))

    expect(
      await screen.findByText("roses are blooming at humboldthain")
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "light a flare" }))
    expect(mocks.openDrawer).toHaveBeenCalledTimes(1)
    expect(mocks.openDrawer).toHaveBeenCalledWith({
      title: "roses are blooming at humboldthain",
      category: "hangout",
      place: expect.objectContaining({
        source: "place",
        name: "Humboldthain Rosengarten",
        coordinates: [13.3872879, 52.5474434],
      }),
    })
  })

  it("uses the last known position the way the map's camera does", async () => {
    mocks.geo.lastKnownCoords = BERLIN
    renderMap()
    await userEvent.click(chip("hangout"))
    expect(
      await screen.findByText("roses are blooming at humboldthain")
    ).toBeInTheDocument()
  })

  it("outside the curated area: the generic card, opening with the category", async () => {
    mocks.geo.coords = SAN_FRANCISCO
    renderMap()
    await userEvent.click(chip("food"))

    await userEvent.click(
      await screen.findByRole("button", { name: "light a food flare" })
    )
    expect(mocks.openDrawer).toHaveBeenCalledWith({ category: "food" })
  })

  it("a live flare of the type replaces the card with the rail", async () => {
    mocks.geo.coords = BERLIN
    mocks.events = [
      {
        id: "e1",
        title: "picnic at humboldthain",
        type: "hangout",
        visibility: "public",
        startAt: new Date(JUNE - 10 * 60_000).toISOString(),
        endAt: new Date(JUNE + 60 * 60_000).toISOString(),
        going: 1,
        host: { id: "h", name: "maya", avatar: "m" },
        location: { name: "humboldthain", coordinates: [13.3873, 52.5474] },
      } as unknown as EventItem,
    ]
    renderMap()
    await userEvent.click(chip("hangout"))

    expect(
      screen.queryByText("roses are blooming at humboldthain")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("idea")).not.toBeInTheDocument()
    const rail = screen.getByRole("region", { name: "flares near you" })
    expect(within(rail).getByText("picnic at humboldthain")).toBeInTheDocument()
  })
})
