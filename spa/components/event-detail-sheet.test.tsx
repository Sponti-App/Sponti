import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventDetailSheet } from "./event-detail-sheet"
import type { EventItem } from "@/lib/api/events"

const MIN = 60_000

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "guest-1" } }),
}))

const at = (offsetMin: number) => new Date(Date.now() + offsetMin * MIN).toISOString()

function flare(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event-1",
    hostId: "host-1",
    title: "after-work pints",
    type: "drinks",
    startAt: at(-10),
    endAt: at(90),
    visibility: "private",
    myRsvp: "invited",
    host: { id: "host-1", name: "Sarah Kim", avatar: "SK", color: "bg-stone-400", note: "" },
    location: { name: "the harp", coordinates: [9.99, 53.55] },
    attendees: [],
    going: 1,
    ...overrides,
  }
}

function renderSheet(props: Partial<React.ComponentProps<typeof EventDetailSheet>> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onJoin: vi.fn(),
    onLeave: vi.fn(),
    onSeeRoute: vi.fn(),
  }
  render(
    <EventDetailSheet open event={flare()} joined={false} {...handlers} {...props} />
  )
  return handlers
}

// #139: the map's sheet shows the same header and main action as the full
// page, and is the way into the flare's thread from the map.
describe("EventDetailSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("opens the thread composer on the full page from a joined guest's 'share an update'", async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet({ joined: true })

    await user.click(await screen.findByRole("button", { name: /share an update/ }))

    expect(onClose).toHaveBeenCalled()
    expect(mocks.push).toHaveBeenCalledWith("/event/event-1?tab=updates&compose=1")
  })

  it("gives the host 'share an update' too", async () => {
    renderSheet({ isHost: true })

    expect(await screen.findByRole("button", { name: /share an update/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit flare/ })).toBeInTheDocument()
  })

  it("lets an invited guest join with an ETA, or open the full flare", async () => {
    const user = userEvent.setup()
    const { onJoin } = renderSheet()

    await user.click(await screen.findByRole("button", { name: "15m" }))
    await user.click(screen.getByRole("button", { name: "join" }))
    expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({ id: "event-1" }), "15 min")

    await user.click(screen.getByRole("button", { name: /see details and updates/ }))
    expect(mocks.push).toHaveBeenCalledWith("/event/event-1")
  })

  it("links the place to Google Maps", async () => {
    renderSheet()

    expect(
      await screen.findByRole("link", { name: "open the harp in google maps" })
    ).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=53.55%2C9.99")
  })
})
