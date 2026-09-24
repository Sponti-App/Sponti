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
