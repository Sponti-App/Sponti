import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EventEditPage from "./page"
import type { HostedEvent } from "@/lib/api/events"

const mocks = vi.hoisted(() => ({
  cancelEvent: vi.fn(),
  fetchHostedEventById: vi.fn(),
  push: vi.fn(),
  reactivateEvent: vi.fn(),
  showActionFeedback: vi.fn(),
  updateEvent: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "event-1" }),
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <nav aria-label="primary" />,
}))

vi.mock("@/components/cancel-event-dialog", () => ({
  CancelEventDialog: ({ onConfirm }: { onConfirm: () => void }) => (
    <button type="button" onClick={onConfirm}>
      confirm cancel
    </button>
  ),
}))

vi.mock("@/lib/api/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/events")>()
  return {
    ...actual,
    cancelEvent: mocks.cancelEvent,
    fetchHostedEventById: mocks.fetchHostedEventById,
    reactivateEvent: mocks.reactivateEvent,
    updateEvent: mocks.updateEvent,
  }
})

function hostedEvent(overrides: Partial<HostedEvent> = {}): HostedEvent {
  return {
    id: "event-1",
    title: "coffee at annex",
    type: "drinks",
    startAt: "2099-06-01T18:00:00.000Z",
    endAt: "2099-06-01T19:00:00.000Z",
    locationLabel: "the annex",
    locationDetail: "rooftop bar",
    audienceLabel: "public",
    attendeeCount: 2,
    attendingCount: 1,
    guestLimit: 0,
    visibility: "public",
    recurrence: "none",
    apiStatus: "active",
    updatedAt: "2099-05-01T12:00:00.000Z",
    ...overrides,
  }
}

describe("EventEditPage action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())
    mocks.updateEvent.mockResolvedValue(hostedEvent())
    mocks.cancelEvent.mockResolvedValue(hostedEvent({ apiStatus: "cancelled" }))
    mocks.reactivateEvent.mockResolvedValue(hostedEvent())
  })

  it("confirms when flare edits are saved", async () => {
    const user = userEvent.setup()
    render(<EventEditPage />)

    const title = await screen.findByDisplayValue("coffee at annex")
    await user.clear(title)
    await user.type(title, "coffee nearby")
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled())
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("flare updated")
    expect(mocks.push).toHaveBeenCalledWith("/event")
  })

  it("confirms when a flare is cancelled", async () => {
    const user = userEvent.setup()
    render(<EventEditPage />)

    await screen.findByDisplayValue("coffee at annex")
    await user.click(screen.getByRole("button", { name: "cancel this flare" }))
    await user.click(screen.getByRole("button", { name: "confirm cancel" }))

    await waitFor(() => expect(mocks.cancelEvent).toHaveBeenCalledWith("event-1"))
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("flare cancelled")
    expect(mocks.push).toHaveBeenCalledWith("/event")
  })

  it("confirms when a flare is reactivated", async () => {
    const user = userEvent.setup()
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ apiStatus: "cancelled" })
    )

    render(<EventEditPage />)

    await screen.findByText("this flare is cancelled. reactivate it before making new changes.")
    await user.click(screen.getByRole("button", { name: "reactivate this flare" }))

    await waitFor(() =>
      expect(mocks.reactivateEvent).toHaveBeenCalledWith("event-1")
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("flare reactivated")
    expect(mocks.push).toHaveBeenCalledWith("/event")
  })

  it("surfaces feedback when flare edits fail", async () => {
    const user = userEvent.setup()
    mocks.updateEvent.mockRejectedValue(new Error("network went quiet"))
    render(<EventEditPage />)

    const title = await screen.findByDisplayValue("coffee at annex")
    await user.clear(title)
    await user.type(title, "coffee nearby")
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't update flare",
        { tone: "error" }
      )
    )
  })
})
