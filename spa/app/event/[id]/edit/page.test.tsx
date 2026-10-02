import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import EventEditPage from "./page"
import type { HostedEvent } from "@/lib/api/events"

const mocks = vi.hoisted(() => ({
  cancelEvent: vi.fn(),
  fetchEventGuests: vi.fn(),
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
    fetchEventGuests: mocks.fetchEventGuests,
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
    createdAt: "2099-05-01T12:00:00.000Z",
    updatedAt: "2099-05-01T12:00:00.000Z",
    ...overrides,
  }
}

describe("EventEditPage action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())
    mocks.fetchEventGuests.mockResolvedValue([])
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

  it("keeps the disabled save button a solid surface instead of see-through", async () => {
    render(<EventEditPage />)

    await screen.findByDisplayValue("coffee at annex")
    const saveButton = screen.getByRole("button", { name: "no changes yet" })

    expect(saveButton).toBeDisabled()
    // A disabled floating button must stay a solid surface (muted colours on
    // an opaque bg), not fade out via opacity — otherwise page content
    // scrolling underneath shows through it (#217).
    expect(saveButton.className).not.toMatch(/disabled:opacity-(?!100\b)/)
    expect(saveButton.className).toMatch(/disabled:bg-muted/)
  })

  it("confirms when a flare is cancelled", async () => {
    const user = userEvent.setup()
    render(<EventEditPage />)

    await screen.findByDisplayValue("coffee at annex")
    await user.click(screen.getByRole("button", { name: "cancel this flare" }))
    await user.click(screen.getByRole("button", { name: "confirm cancel" }))

    await waitFor(() =>
      expect(mocks.cancelEvent).toHaveBeenCalledWith("event-1")
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("flare cancelled")
    expect(mocks.push).toHaveBeenCalledWith("/event")
  })

  it("confirms when a flare is reactivated", async () => {
    const user = userEvent.setup()
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ apiStatus: "cancelled" })
    )

    render(<EventEditPage />)

    await screen.findByText(
      "this flare is cancelled. reactivate it before making new changes."
    )
    await user.click(
      screen.getByRole("button", { name: "reactivate this flare" })
    )

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

// #149: a host can switch a flare between public and private from edit flare.
const guest = (
  id: string,
  rsvpStatus: string,
  joinedWithoutInvite: boolean
) => ({
  user: { _id: id, displayName: id, username: id },
  role: "guest",
  rsvpStatus,
  joinedWithoutInvite,
})

// #312: a "right now" flare can start 15 to 60 minutes out. Its start has
// seconds, so an untouched start must not move it. #330: it edits through the
// right-now start chips, measured from when it was lit.
describe("EventEditPage delayed flare", () => {
  const delayed = hostedEvent({
    createdAt: "2099-06-01T17:30:37.123Z",
    startAt: "2099-06-01T18:00:37.123Z",
    endAt: "2099-06-01T19:00:37.123Z",
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchHostedEventById.mockResolvedValue(delayed)
    mocks.updateEvent.mockResolvedValue(delayed)
  })

  it("isn't marked changed just by opening it", async () => {
    render(<EventEditPage />)
    await screen.findByDisplayValue("coffee at annex")
    expect(
      screen.getByRole("button", { name: "no changes yet" })
    ).toBeDisabled()
  })

  it("keeps the start when only the title changes", async () => {
    const user = userEvent.setup()
    render(<EventEditPage />)

    const title = await screen.findByDisplayValue("coffee at annex")
    await user.clear(title)
    await user.type(title, "coffee nearby")
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled())
    expect(mocks.updateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        startAt: delayed.startAt,
        endAt: delayed.endAt,
      })
    )
  })
})

describe("EventEditPage delayed flare start chips (#330)", () => {
  const delayed = hostedEvent({
    createdAt: "2099-06-01T17:30:37.123Z",
    startAt: "2099-06-01T18:00:37.123Z",
    endAt: "2099-06-01T19:00:37.123Z",
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchHostedEventById.mockResolvedValue(delayed)
    mocks.updateEvent.mockResolvedValue(delayed)
  })

  it("opens with the start chips on 30m and no date or time fields", async () => {
    render(<EventEditPage />)
    const starts = await screen.findByRole("group", { name: "starts" })
    expect(
      Array.from(starts.querySelectorAll("button")).map((b) => [
        b.textContent,
        b.getAttribute("aria-pressed"),
      ])
    ).toEqual([
      ["now", "false"],
      ["15m", "false"],
      ["30m", "true"],
      ["1h", "false"],
    ])
    expect(screen.queryByLabelText("date")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("start")).not.toBeInTheDocument()
    // The duration chips are still there.
    expect(screen.getByRole("button", { name: "2h" })).toBeInTheDocument()
  })

  it("starts it at lit time + the new offset, keeping the duration", async () => {
    const user = userEvent.setup()
    render(<EventEditPage />)
    const starts = await screen.findByRole("group", { name: "starts" })
    await user.click(within(starts).getByRole("button", { name: "1h" }))
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled())
    expect(mocks.updateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        startAt: "2099-06-01T18:30:37.123Z",
        endAt: "2099-06-01T19:30:37.123Z",
      })
    )
  })

  it("is back to unchanged after picking the original offset again", async () => {
    const user = userEvent.setup()
    render(<EventEditPage />)
    const starts = await screen.findByRole("group", { name: "starts" })
    await user.click(within(starts).getByRole("button", { name: "15m" }))
    expect(screen.getByRole("button", { name: "save changes" })).toBeEnabled()
    await user.click(within(starts).getByRole("button", { name: "30m" }))
    expect(
      screen.getByRole("button", { name: "no changes yet" })
    ).toBeDisabled()
  })

  it("can't move the start to a time already gone", async () => {
    const MIN = 60_000
    const created = Date.now() - 20 * MIN
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        createdAt: new Date(created).toISOString(),
        startAt: new Date(created + 30 * MIN).toISOString(),
        endAt: new Date(created + 90 * MIN).toISOString(),
      })
    )
    render(<EventEditPage />)
    const starts = await screen.findByRole("group", { name: "starts" })
    expect(within(starts).getByRole("button", { name: "now" })).toBeDisabled()
    expect(within(starts).getByRole("button", { name: "15m" })).toBeDisabled()
    expect(within(starts).getByRole("button", { name: "30m" })).toBeEnabled()
    expect(within(starts).getByRole("button", { name: "1h" })).toBeEnabled()
  })

  it("hides the start chips once the flare is live", async () => {
    const MIN = 60_000
    const created = Date.now() - 20 * MIN
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        createdAt: new Date(created).toISOString(),
        startAt: new Date(created + 15 * MIN).toISOString(),
        endAt: new Date(created + 75 * MIN).toISOString(),
      })
    )
    render(<EventEditPage />)
    await screen.findByText(/this flare is live/)
    expect(
      screen.queryByRole("group", { name: "starts" })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("date")).not.toBeInTheDocument()
  })

  it("still edits a flare 45 min after it was made as a scheduled one", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({
        createdAt: "2099-06-01T17:15:00.000Z",
        startAt: "2099-06-01T18:00:00.000Z",
        endAt: "2099-06-01T19:00:00.000Z",
      })
    )
    render(<EventEditPage />)
    expect(await screen.findByLabelText("date")).toBeInTheDocument()
    expect(
      screen.queryByRole("group", { name: "starts" })
    ).not.toBeInTheDocument()
  })
})

describe("EventEditPage details", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchEventGuests.mockResolvedValue([])
    mocks.updateEvent.mockResolvedValue(hostedEvent())
  })

  it("lets the host add details to a flare that has none", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())
    const user = userEvent.setup()
    render(<EventEditPage />)

    await user.type(
      await screen.findByRole("textbox", { name: "details" }),
      "bring a jumper"
    )
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() =>
      expect(mocks.updateEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ description: "bring a jumper" })
      )
    )
  })

  it("clears the details when the host empties them", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ description: "first round's on me" })
    )
    const user = userEvent.setup()
    render(<EventEditPage />)

    await user.clear(await screen.findByDisplayValue("first round's on me"))
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() =>
      expect(mocks.updateEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ description: null })
      )
    )
  })

  it("leaves the details out of the update when they didn't change", async () => {
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ description: "first round's on me" })
    )
    const user = userEvent.setup()
    render(<EventEditPage />)

    const title = await screen.findByDisplayValue("coffee at annex")
    await user.type(title, "!")
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled())
    expect(mocks.updateEvent.mock.calls[0]?.[1]).not.toHaveProperty(
      "description"
    )
  })
})

describe("EventEditPage visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent())
    mocks.fetchEventGuests.mockResolvedValue([])
    mocks.updateEvent.mockResolvedValue(hostedEvent())
  })

  async function toggleVisibility(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("switch", { name: "public" }))
  }

  it("reflects whether the flare is public", async () => {
    render(<EventEditPage />)

    expect(await screen.findByRole("switch", { name: "public" })).toBeChecked()
    expect(
      screen.getByText("anyone can find it on the map and join")
    ).toBeInTheDocument()
  })

  it("makes a public flare private straight away when nobody joined on their own", async () => {
    const user = userEvent.setup()
    mocks.fetchEventGuests.mockResolvedValue([guest("ana", "going", false)])
    render(<EventEditPage />)

    await toggleVisibility(user)
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() =>
      expect(mocks.updateEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ visibility: "private" })
      )
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("warns how many joined without an invite before making it private", async () => {
    const user = userEvent.setup()
    mocks.fetchEventGuests.mockResolvedValue([
      guest("ana", "going", false),
      guest("sam", "going", true),
      guest("kim", "going", true),
      // Joined on their own but not going: they're dropped, so they aren't counted.
      guest("lee", "declined", true),
    ])
    render(<EventEditPage />)

    await toggleVisibility(user)
    await user.click(screen.getByRole("button", { name: "save changes" }))

    expect(
      await screen.findByRole("dialog", { name: "make this flare private?" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("2 people joined without an invite")
    ).toBeInTheDocument()
    expect(mocks.updateEvent).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "make private" }))
    await waitFor(() =>
      expect(mocks.updateEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ visibility: "private" })
      )
    )
  })

  it("keeps the flare public when the host backs out of the warning", async () => {
    const user = userEvent.setup()
    mocks.fetchEventGuests.mockResolvedValue([guest("sam", "going", true)])
    render(<EventEditPage />)

    await toggleVisibility(user)
    await user.click(screen.getByRole("button", { name: "save changes" }))
    await user.click(
      await screen.findByRole("button", { name: "keep it public" })
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.updateEvent).not.toHaveBeenCalled()
  })

  it("makes a private flare public without a warning", async () => {
    const user = userEvent.setup()
    mocks.fetchHostedEventById.mockResolvedValue(
      hostedEvent({ visibility: "private" })
    )
    render(<EventEditPage />)

    await toggleVisibility(user)
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() =>
      expect(mocks.updateEvent).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({ visibility: "public" })
      )
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("flare updated")
  })

  it("doesn't send a visibility change when only the title changes", async () => {
    const user = userEvent.setup()
    render(<EventEditPage />)

    const title = await screen.findByDisplayValue("coffee at annex")
    await user.type(title, "!")
    await user.click(screen.getByRole("button", { name: "save changes" }))

    await waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled())
    expect(mocks.updateEvent.mock.calls[0]?.[1]).not.toHaveProperty(
      "visibility"
    )
  })
})

describe("EventEditPage guest removal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchEventGuests.mockResolvedValue([
      {
        user: { _id: "u-sam", displayName: "sam", username: "sam" },
        role: "guest",
        rsvpStatus: "invited",
      },
    ])
  })

  it.each([
    ["upcoming", {}],
    [
      "live",
      {
        startAt: "2000-01-01T18:00:00.000Z",
        endAt: "2099-06-01T19:00:00.000Z",
      },
    ],
  ])(
    "lets the host remove a guest from an %s flare",
    async (_label, overrides) => {
      mocks.fetchHostedEventById.mockResolvedValue(hostedEvent(overrides))
      render(<EventEditPage />)

      expect(
        await screen.findByRole("button", { name: "remove sam" })
      ).toBeInTheDocument()
    }
  )

  it.each([
    [
      "ended",
      {
        startAt: "2000-01-01T18:00:00.000Z",
        endAt: "2000-01-01T19:00:00.000Z",
      },
    ],
    ["cancelled", { apiStatus: "cancelled" as const }],
  ])("doesn't offer removal on an %s flare", async (_label, overrides) => {
    mocks.fetchHostedEventById.mockResolvedValue(hostedEvent(overrides))
    render(<EventEditPage />)

    await screen.findByText("sam")
    expect(
      screen.queryByRole("button", { name: "remove sam" })
    ).not.toBeInTheDocument()
  })
})
