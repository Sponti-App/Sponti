import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EventDetailPage from "./page"
import { HttpError } from "@/lib/http"
import type { HostedEvent } from "@/lib/api/events"

const mocks = vi.hoisted(() => ({
  fetchHostedEventById: vi.fn(),
  showActionFeedback: vi.fn(),
  updateMyRsvp: vi.fn(),
  fetchEventUpdates: vi.fn(() => Promise.resolve([] as unknown[])),
  postEventUpdate: vi.fn(),
  deleteEventUpdate: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "event-1" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "guest-1", displayName: "guest" } }),
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

function hostedEvent(overrides: Partial<HostedEvent> = {}): HostedEvent {
  return {
    id: "event-1",
    hostId: "host-1",
    title: "rooftop party",
    type: "party",
    startAt: "2099-06-01T18:00:00.000Z",
    endAt: "2099-06-01T19:00:00.000Z",
    locationLabel: "the annex",
    locationDetail: "rooftop bar",
    audienceLabel: "public",
    attendeeCount: 2,
    attendingCount: 1,
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

describe("EventDetailPage guest limit (#181)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows an exact spots count when the limit is enforced", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 1, guestLimit: 2, allowGuestInvites: "none" })
    )

    render(<EventDetailPage />)

    expect(await screen.findByText("1 of 2 going")).toBeInTheDocument()
  })

  it("shows an approximate spots count once +1/re-share is on", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 1, guestLimit: 2, allowGuestInvites: "single" })
    )

    render(<EventDetailPage />)

    expect(await screen.findByText("1 going · about 2 spots")).toBeInTheDocument()
  })

  it("never shows the guest limit on a private flare", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        visibility: "private",
        attendingCount: 1,
        attendeeCount: 1,
        guestLimit: 10,
        allowGuestInvites: "none",
      })
    )

    render(<EventDetailPage />)

    expect(await screen.findByText("1 going")).toBeInTheDocument()
    expect(screen.queryByText(/of 10 going|about 10 spots/)).not.toBeInTheDocument()
  })

  it("shows a lowercase 'full' state instead of a generic error when the flare is at capacity", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "invited", attendingCount: 2, guestLimit: 2 })
    )
    mocks.updateMyRsvp.mockRejectedValue(
      new HttpError(409, "This flare is full", "EVENT_FULL")
    )
    const user = userEvent.setup()

    render(<EventDetailPage />)

    const goingButton = await screen.findByRole("button", { name: "going" })
    await user.click(goingButton)

    expect(await screen.findByRole("alert")).toHaveTextContent("full")
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("full", { tone: "error" })
  })

  it("shows a generic error for any other RSVP failure", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "invited", attendingCount: 0, guestLimit: 2 })
    )
    mocks.updateMyRsvp.mockRejectedValue(new HttpError(500, "server exploded"))
    const user = userEvent.setup()

    render(<EventDetailPage />)

    const goingButton = await screen.findByRole("button", { name: "going" })
    await user.click(goingButton)

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("couldn't save that", {
        tone: "error",
      })
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("server exploded")
  })
})

// #158: the guest list and rsvp count only caught up with another account's
// change once this page remounted. It now refetches on window focus, the
// same shared mechanism the events hooks use (#197).
describe("EventDetailPage refetch on focus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refetches the event when the window regains focus", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 0 })
    )
    render(<EventDetailPage />)
    expect(await screen.findByText("0 of 2 going")).toBeInTheDocument()
    expect(mocks.fetchHostedEventById).toHaveBeenCalledTimes(1)

    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ attendingCount: 1 })
    )
    window.dispatchEvent(new Event("focus"))

    expect(await screen.findByText("1 of 2 going")).toBeInTheDocument()
  })
})

describe("EventDetailPage thread (#140)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchEventUpdates.mockResolvedValue([])
  })

  const update = (overrides: Record<string, unknown> = {}) => ({
    _id: "update-1",
    eventId: "event-1",
    authorId: "host-1",
    author: { _id: "host-1", displayName: "Martin", username: "martin" },
    body: "grabbing a table by the window",
    createdAt: new Date().toISOString(),
    canDelete: false,
    ...overrides,
  })

  it("shows an invited guest how many updates there are, but not the updates", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "invited", updateCount: 3 })
    )

    render(<EventDetailPage />)

    expect(
      await screen.findByText("3 updates · join to see")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("tab", { name: "thread" })
    ).not.toBeInTheDocument()
    expect(mocks.fetchEventUpdates).not.toHaveBeenCalled()
  })

  it("hides the locked line when there are no updates", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "declined", updateCount: 0 })
    )

    render(<EventDetailPage />)

    expect(await screen.findByText("rooftop party")).toBeInTheDocument()
    expect(screen.queryByText(/join to see/)).not.toBeInTheDocument()
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

    await user.click(await screen.findByRole("tab", { name: "thread" }))
    expect(
      await screen.findByText("grabbing a table by the window")
    ).toBeInTheDocument()
    expect(screen.queryByText(/join to see/)).not.toBeInTheDocument()
    // Only updates the viewer may delete get a delete control.
    expect(
      screen.queryByRole("button", { name: "delete update" })
    ).not.toBeInTheDocument()

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
  })

  it("replaces the composer with a read-only note once the flare is cancelled", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ myRsvp: "going", apiStatus: "cancelled", updateCount: 1 })
    )
    mocks.fetchEventUpdates.mockResolvedValue([update()])
    const user = userEvent.setup()

    render(<EventDetailPage />)

    await user.click(await screen.findByRole("tab", { name: "thread" }))
    expect(
      await screen.findByText(
        "this flare was cancelled · the thread is read-only"
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("textbox", { name: "update" })
    ).not.toBeInTheDocument()
  })
})
