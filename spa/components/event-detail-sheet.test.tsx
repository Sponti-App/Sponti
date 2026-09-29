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

  it("links the host's row to their profile (#199)", async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet({
      event: flare({
        host: { id: "host-1", name: "Sarah Kim", username: "sarah", avatar: "SK", color: "bg-stone-400", note: "" },
      }),
    })

    const link = await screen.findByRole("link", { name: /hosted by sarah kim/ })
    expect(link).toHaveAttribute("href", "/profile/sarah")
    await user.click(link)
    // Closes first, like the other exits, so vaul's scroll lock doesn't leak (#168).
    expect(onClose).toHaveBeenCalled()
  })

  it("leaves the host row plain when it is you, or there is no username to link", async () => {
    renderSheet({
      event: flare({
        host: { id: "guest-1", name: "Me", username: "me", avatar: "M", color: "bg-stone-400", note: "" },
      }),
    })
    expect(await screen.findByText("hosted by you")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /open profile/ })).not.toBeInTheDocument()
  })

  it("does not link a host the api sent without a username", async () => {
    renderSheet()
    expect(await screen.findByText("hosted by sarah kim")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /open profile/ })).not.toBeInTheDocument()
  })

  it("keeps the secondary actions together in one row, not beside the main action", async () => {
    renderSheet({ joined: true, event: flare({ startAt: at(60 * 24), endAt: at(60 * 27) }) })

    const cantMakeIt = await screen.findByRole("button", { name: "can't make it" })
    const openFlare = screen.getByRole("button", { name: /open flare/ })
    const share = screen.getByRole("button", { name: /share an update/ })

    // Same row as "open flare", and out of the main action's row.
    expect(cantMakeIt.parentElement).toBe(openFlare.parentElement)
    expect(share.parentElement).not.toBe(cantMakeIt.parentElement)
  })

  it("pairs the host's edit and open actions, and lets a lone action take the full width", async () => {
    renderSheet({ isHost: true })
    const edit = await screen.findByRole("button", { name: /edit flare/ })
    const open = screen.getByRole("button", { name: /open flare/ })
    expect(edit.parentElement).toBe(open.parentElement)
    expect(edit.parentElement).toHaveClass("grid-cols-2")
  })

  it("says so in one line when no one is going yet, instead of a label over an empty row", async () => {
    renderSheet({ event: flare({ going: 0, attendees: [] }) })
    expect(await screen.findByText("no one going yet")).toBeInTheDocument()
    expect(screen.queryByText("who's going")).not.toBeInTheDocument()
  })

  it("links the place to Google Maps", async () => {
    renderSheet()

    expect(
      await screen.findByRole("link", { name: "open the harp in google maps" })
    ).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=53.55%2C9.99")
  })

  it("offers on time / running late, not minutes, when joining a flare starting within the hour (#211)", async () => {
    const user = userEvent.setup()
    const { onJoin } = renderSheet({
      event: flare({ startAt: at(40), endAt: at(160) }),
    })

    expect(screen.queryByRole("button", { name: "15m" })).not.toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: "running late" }))
    await user.click(screen.getByRole("button", { name: "join" }))

    expect(onJoin).toHaveBeenCalledWith(
      expect.objectContaining({ id: "event-1" }),
      "running_late"
    )
  })

  it("shows the host a going attendee's on-time/running-late answer, running late in the accent colour (#211)", async () => {
    renderSheet({
      isHost: true,
      event: flare({
        startAt: at(40),
        endAt: at(160),
        attendees: [
          { id: "g1", name: "Priya", avatar: "P", color: "bg-stone-300", arrivalStatus: "running_late" },
          { id: "g2", name: "Tom", avatar: "T", color: "bg-stone-300", arrivalStatus: "on_time" },
        ],
      }),
    })

    const late = await screen.findByText("running late")
    const onTime = screen.getByText("on time")
    expect(late).toHaveClass("text-accent")
    expect(onTime).not.toHaveClass("text-accent")
  })
})
