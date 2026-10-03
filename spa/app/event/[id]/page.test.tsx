import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EventDetailPage from "./page"
import { HttpError } from "@/lib/http"
import type { HostedEvent } from "@/lib/api/events"

const MIN = 60_000

const mocks = vi.hoisted(() => ({
  fetchHostedEventById: vi.fn(),
  showActionFeedback: vi.fn(),
  updateMyRsvp: vi.fn(),
  fetchEventUpdates: vi.fn(() => Promise.resolve([] as unknown[])),
  postEventUpdate: vi.fn(),
  deleteEventUpdate: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
  userId: "guest-1",
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "event-1" }),
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: mocks.userId, displayName: "guest" } }),
}))

vi.mock("@/lib/api/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/events")>()
  return {
    ...actual,
    fetchHostedEventById: mocks.fetchHostedEventById,
    updateMyRsvp: mocks.updateMyRsvp,
    fetchEventUpdates: mocks.fetchEventUpdates,
    postEventUpdate: mocks.postEventUpdate,
    deleteEventUpdate: mocks.deleteEventUpdate,
  }
})

const at = (offsetMin: number) =>
  new Date(Date.now() + offsetMin * MIN).toISOString()

function hostedEvent(overrides: Partial<HostedEvent> = {}): HostedEvent {
  return {
    id: "event-1",
    hostId: "host-1",
    hostName: "Sarah Kim",
    title: "rooftop party",
    type: "party",
    // Later today-ish: outside the 1h ETA window unless a test says so.
    startAt: at(5 * 60),
    endAt: at(7 * 60),
    locationLabel: "the annex",
    locationDetail: "47 chandos pl",
    coordinates: { lat: 53.55, lng: 9.99 },
    audienceLabel: "public",
    attendeeCount: 2,
    attendingCount: 1,
    attendees: [{ id: "guest-2", displayName: "Maya Chen" }],
    guestLimit: 2,
    allowGuestInvites: "none",
    myRsvp: "invited",
    visibility: "public",
    recurrence: "none",
    apiStatus: "active",
    createdAt: "2099-05-01T12:00:00.000Z",
    updatedAt: "2099-05-01T12:00:00.000Z",
    ...overrides,
  }
}

const update = (overrides: Record<string, unknown> = {}) => ({
  _id: "update-1",
  eventId: "event-1",
  authorId: "host-1",
  author: { _id: "host-1", displayName: "Sarah Kim", username: "sarah" },
  body: "grabbing a table by the window",
  createdAt: new Date().toISOString(),
  canDelete: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.searchParams = new URLSearchParams()
  mocks.userId = "guest-1"
  mocks.fetchEventUpdates.mockResolvedValue([])
  mocks.updateMyRsvp.mockResolvedValue({ data: {} })
})

describe("EventDetailPage layout (#139)", () => {
  it("shows an invited guest the compact header, a tappable place and a join bar", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())

    render(<EventDetailPage />)

    expect(
      await screen.findByRole("heading", { name: "rooftop party" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "open the annex in google maps" })
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=53.55%2C9.99"
    )
    // "open in maps" is always there, whatever the distance.
    expect(
      screen.getByRole("link", { name: /open in maps/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "join" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /share an update/ })
    ).not.toBeInTheDocument()
  })

  it("reads as a page: no fake drawer handle or rounded sheet top (#352)", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())

    const { container } = render(<EventDetailPage />)
    await screen.findByRole("heading", { name: "rooftop party" })

    // The map's flare sheet is a real drawer with a handle; this page is not.
    expect(container.querySelector(".h-1\\.5.w-10")).toBeNull()
    expect(container.querySelector(".rounded-t-3xl")).toBeNull()
  })

  it("gives a joined guest 'share an update', which opens the composer on the updates tab", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going" })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    await user.click(
      await screen.findByRole("button", { name: /share an update/ })
    )

    expect(screen.getByRole("textbox", { name: "update" })).toHaveFocus()
    expect(screen.getByRole("tab", { name: /updates/ })).toHaveAttribute(
      "data-state",
      "active"
    )
    expect(
      screen.queryByRole("button", { name: "join" })
    ).not.toBeInTheDocument()
  })

  it("gives the host 'share an update' and an edit button", async () => {
    mocks.userId = "host-1"
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going" })
    )

    render(<EventDetailPage />)

    expect(
      await screen.findByRole("button", { name: /share an update/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "edit flare" })
    ).toBeInTheDocument()
    expect(screen.getByText("hosting")).toBeInTheDocument()
  })

  it("shows the host an arrival board sorted by ETA while live", async () => {
    mocks.userId = "host-1"
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        myRsvp: "going",
        startAt: at(-10),
        endAt: at(90),
        attendingCount: 3,
        attendees: [
          { id: "g-late", displayName: "Priya Shah", willArriveAt: at(25) },
          { id: "g-none", displayName: "Tom Okafor", willArriveAt: null },
          { id: "g-soon", displayName: "Jonas Weber", willArriveAt: at(5) },
        ],
      })
    )

    render(<EventDetailPage />)

    const board = await screen.findByRole("list")
    const rows = within(board).getAllByRole("listitem")
    expect(rows.map((row) => row.textContent)).toEqual([
      "JWjonas weberarriving in 5 min",
      "PSpriya shaharriving in 25 min",
      "TOtom okaforno eta",
    ])
  })

  it("shows the host on-time/running-late answers for a flare starting soon (#211)", async () => {
    mocks.userId = "host-1"
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        myRsvp: "going",
        startAt: at(40),
        endAt: at(160),
        attendingCount: 2,
        attendees: [
          {
            id: "g-late",
            displayName: "Priya Shah",
            arrivalStatus: "running_late",
          },
          {
            id: "g-ontime",
            displayName: "Tom Okafor",
            arrivalStatus: "on_time",
          },
        ],
      })
    )

    render(<EventDetailPage />)

    const board = await screen.findByRole("list")
    const rows = within(board).getAllByRole("listitem")
    expect(rows.map((row) => row.textContent)).toEqual([
      "PSpriya shahrunning late",
      "TOtom okaforon time",
    ])
  })

  it("shows guests names only, never ETAs", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        myRsvp: "going",
        attendees: [
          { id: "guest-1", displayName: "Guest One" },
          { id: "guest-2", displayName: "Maya Chen" },
        ],
      })
    )

    render(<EventDetailPage />)

    expect(await screen.findByText("you")).toBeInTheDocument()
    expect(screen.getByText("maya")).toBeInTheDocument()
    expect(screen.queryByText(/arriving/)).not.toBeInTheDocument()
  })

  it("shows a joined guest their own plan while live, and cancel clears the ETA", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        myRsvp: "going",
        startAt: at(-10),
        endAt: at(90),
        myWillArriveAt: at(15),
      })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    expect(
      await screen.findByText("you're arriving in 15 min")
    ).toBeInTheDocument()
    expect(screen.getByText("only sarah sees this")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "cancel" }))

    expect(mocks.updateMyRsvp).toHaveBeenCalledWith("event-1", {
      memberWillArriveAt: null,
    })
  })

  it("sends the chosen ETA when joining a live flare", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ startAt: at(-10), endAt: at(90) })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    expect(
      await screen.findByText("when will you get there?")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "15m" }))
    await user.click(screen.getByRole("button", { name: "join" }))

    const body = mocks.updateMyRsvp.mock.calls[0]?.[1]
    expect(body.rsvpStatus).toBe("going")
    // An api without #211 rejects unknown keys, so an unused arrivalStatus
    // must be absent from the body, not null.
    expect(body).not.toHaveProperty("arrivalStatus")
    const minutes =
      (new Date(body.memberWillArriveAt).getTime() - Date.now()) / MIN
    expect(minutes).toBeGreaterThan(14)
    expect(minutes).toBeLessThanOrEqual(15)
  })

  it("offers on time / running late, not minutes, when joining a flare starting within the hour (#211)", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ startAt: at(40), endAt: at(160) })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    expect(
      await screen.findByText("when will you get there?")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "15m" })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "running late" }))
    await user.click(screen.getByRole("button", { name: "join" }))

    const body = mocks.updateMyRsvp.mock.calls[0]?.[1]
    expect(body).toEqual(
      expect.objectContaining({
        rsvpStatus: "going",
        arrivalStatus: "running_late",
      })
    )
    expect(body.memberWillArriveAt).toBeNull()
  })

  it("shows a joined guest their near-term status while soon, and cancel clears it (#211)", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        myRsvp: "going",
        startAt: at(40),
        endAt: at(160),
        myArrivalStatus: "running_late",
      })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    expect(await screen.findByText("you're running late")).toBeInTheDocument()
    expect(screen.getByText("only sarah sees this")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "cancel" }))

    expect(mocks.updateMyRsvp).toHaveBeenCalledWith("event-1", {
      arrivalStatus: null,
    })
  })

  it("reopens the on-time/running-late picker on 'change' while soon (#211)", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        myRsvp: "going",
        startAt: at(40),
        endAt: at(160),
        myArrivalStatus: "on_time",
      })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    await user.click(await screen.findByRole("button", { name: "change" }))
    await user.click(screen.getByRole("button", { name: "running late" }))

    expect(mocks.updateMyRsvp).toHaveBeenCalledWith("event-1", {
      arrivalStatus: "running_late",
    })
  })

  it("doesn't ask for an ETA on a flare that starts more than 1h out", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())

    render(<EventDetailPage />)

    expect(
      await screen.findByRole("button", { name: "join" })
    ).toBeInTheDocument()
    expect(
      screen.queryByText("when will you get there?")
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "can't make it" })
    ).toBeInTheDocument()
  })

  it("drops the action bar once the flare is cancelled", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going", apiStatus: "cancelled" })
    )

    render(<EventDetailPage />)

    expect(await screen.findByText("cancelled")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /share an update/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "join" })
    ).not.toBeInTheDocument()
  })
})

describe("EventDetailPage guest limit (#181)", () => {
  it("shows an exact spots count when the limit is enforced", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        attendingCount: 1,
        guestLimit: 2,
        allowGuestInvites: "none",
      })
    )

    render(<EventDetailPage />)

    expect(await screen.findByText("1 spot left · 2 max")).toBeInTheDocument()
  })

  it("shows an approximate spots count once +1/re-share is on", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        attendingCount: 1,
        guestLimit: 2,
        allowGuestInvites: "single",
      })
    )

    render(<EventDetailPage />)

    expect(
      await screen.findByText("about 1 spot left · 2 max")
    ).toBeInTheDocument()
  })

  it("never shows the guest limit on a private flare", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ visibility: "private", guestLimit: 10 })
    )

    render(<EventDetailPage />)

    expect(
      await screen.findByRole("tab", { name: "1 going" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/spots? left|max/)).not.toBeInTheDocument()
  })

  it("shows a lowercase 'full' state instead of a generic error when the flare is at capacity", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 2, guestLimit: 2 })
    )
    mocks.updateMyRsvp.mockRejectedValue(
      new HttpError(409, "This flare is full", "EVENT_FULL")
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    await user.click(await screen.findByRole("button", { name: "join" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "this flare is full"
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("full", {
      tone: "error",
    })
  })

  it("shows a generic error for any other RSVP failure", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 0 })
    )
    mocks.updateMyRsvp.mockRejectedValue(new HttpError(500, "server exploded"))
    const user = userEvent.setup()

    render(<EventDetailPage />)

    await user.click(await screen.findByRole("button", { name: "join" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't save that",
        {
          tone: "error",
        }
      )
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "server exploded"
    )
  })
})

// #158: the guest list and rsvp count only caught up with another account's
// change once this page remounted. It now refetches on window focus, the
// same shared mechanism the events hooks use (#197).
describe("EventDetailPage refetch on focus", () => {
  it("refetches the event when the window regains focus", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 0 })
    )
    render(<EventDetailPage />)
    expect(
      await screen.findByRole("tab", { name: "0 going" })
    ).toBeInTheDocument()
    expect(mocks.fetchHostedEventById).toHaveBeenCalledTimes(1)

    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 1 })
    )
    window.dispatchEvent(new Event("focus"))

    expect(
      await screen.findByRole("tab", { name: "1 going" })
    ).toBeInTheDocument()
  })
})

describe("EventDetailPage thread (#140)", () => {
  it("shows an invited guest how many updates there are, but not the updates", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ updateCount: 3 })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    await user.click(await screen.findByRole("tab", { name: /updates · 3/ }))
    expect(
      await screen.findByText("3 updates · join to see")
    ).toBeInTheDocument()
    expect(mocks.fetchEventUpdates).not.toHaveBeenCalled()
  })

  it("lets a going guest read the thread and post an update", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going", updateCount: 1 })
    )
    mocks.fetchEventUpdates.mockResolvedValue([update()])
    mocks.postEventUpdate.mockResolvedValue(
      update({
        _id: "update-2",
        authorId: "guest-1",
        author: { _id: "guest-1", displayName: "guest" },
        body: "running 10 late",
        canDelete: true,
      })
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    await user.click(await screen.findByRole("tab", { name: /updates/ }))
    // The host's update reads as an announcement.
    expect(
      await screen.findByText("grabbing a table by the window")
    ).toBeInTheDocument()
    expect(screen.getByText("announcement from sarah")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "delete update" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /share an update/ }))
    await user.type(
      screen.getByRole("textbox", { name: "update" }),
      "  running 10 late "
    )
    await user.click(screen.getByRole("button", { name: "post update" }))

    expect(await screen.findByText("running 10 late")).toBeInTheDocument()
    expect(mocks.postEventUpdate).toHaveBeenCalledWith(
      "event-1",
      "running 10 late"
    )
    expect(
      screen.getByRole("button", { name: "delete update" })
    ).toBeInTheDocument()
    // Posting hands the bar back to the main button.
    expect(
      screen.queryByRole("textbox", { name: "update" })
    ).not.toBeInTheDocument()
  })

  it("opens on the updates tab from a notification link", async () => {
    mocks.searchParams = new URLSearchParams("tab=updates")
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going" })
    )
    mocks.fetchEventUpdates.mockResolvedValue([update()])

    render(<EventDetailPage />)

    expect(
      await screen.findByText("grabbing a table by the window")
    ).toBeInTheDocument()
  })

  it("opens straight into the composer from the map sheet's 'share an update'", async () => {
    mocks.searchParams = new URLSearchParams("tab=updates&compose=1")
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going" })
    )

    render(<EventDetailPage />)

    expect(
      await screen.findByRole("textbox", { name: "update" })
    ).toBeInTheDocument()
  })

  it("keeps a cancelled flare's thread readable, with a read-only note", async () => {
    mocks.searchParams = new URLSearchParams("tab=updates")
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going", apiStatus: "cancelled", updateCount: 1 })
    )
    mocks.fetchEventUpdates.mockResolvedValue([update()])

    render(<EventDetailPage />)

    expect(
      await screen.findByText("grabbing a table by the window")
    ).toBeInTheDocument()
    expect(
      screen.getByText("this flare was cancelled · the thread is read-only")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("textbox", { name: "update" })
    ).not.toBeInTheDocument()
  })
})

describe("EventDetailPage host row (#199)", () => {
  it("links a guest to the host's profile", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ hostUsername: "sarah" })
    )

    render(<EventDetailPage />)

    const link = await screen.findByRole("link", {
      name: /hosted by sarah kim/,
    })
    expect(link).toHaveAttribute("href", "/profile/sarah")
  })

  it("leaves the row plain for the host, and for a host sent without a username", async () => {
    mocks.userId = "host-1"
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ hostUsername: "sarah" })
    )
    const { unmount } = render(<EventDetailPage />)
    expect(await screen.findByText("hosted by you")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /hosted by/ })
    ).not.toBeInTheDocument()
    unmount()

    mocks.userId = "guest-1"
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())
    render(<EventDetailPage />)
    expect(await screen.findByText("hosted by sarah kim")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /hosted by/ })
    ).not.toBeInTheDocument()
  })
})
