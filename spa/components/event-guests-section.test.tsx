import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventGuestsSection } from "./event-guests-section"

const mocks = vi.hoisted(() => ({
  showActionFeedback: vi.fn(),
  fetchEventGuests: vi.fn(),
  inviteEventGuests: vi.fn(),
  fetchMyCircles: vi.fn(),
  fetchAcceptedConnections: vi.fn(),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: mocks.showActionFeedback }),
}))

vi.mock("@/lib/api/events", () => ({
  fetchEventGuests: mocks.fetchEventGuests,
  inviteEventGuests: mocks.inviteEventGuests,
}))

vi.mock("@/lib/api/circles", () => ({
  fetchMyCircles: mocks.fetchMyCircles,
}))

vi.mock("@/lib/api/connections", () => ({
  fetchAcceptedConnections: mocks.fetchAcceptedConnections,
}))

const guest = (id: string, name: string, rsvpStatus: string) => ({
  user: { _id: id, displayName: name, username: name },
  role: "guest",
  rsvpStatus,
})

const connection = (id: string, name: string) => ({
  id,
  displayName: name,
  username: name,
})

describe("EventGuestsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchEventGuests.mockResolvedValue([
      guest("u-sam", "sam", "invited"),
      guest("u-ana", "ana", "going"),
    ])
    mocks.fetchAcceptedConnections.mockResolvedValue([
      connection("u-sam", "sam"),
      connection("u-ana", "ana"),
      connection("u-lee", "lee"),
    ])
    mocks.fetchMyCircles.mockResolvedValue([
      {
        id: "c-close",
        name: "close friends",
        description: "",
        type: "close",
        memberIds: ["u-ana", "u-lee"],
      },
    ])
    mocks.inviteEventGuests.mockResolvedValue({ invitedUserIds: ["u-lee"] })
  })

  it("lists guests going first with a status summary", async () => {
    render(<EventGuestsSection eventId="e1" canInvite />)

    expect(await screen.findByText("1 going · 1 invited")).toBeInTheDocument()
    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "")
    expect(names[0]).toContain("ana")
    expect(names[1]).toContain("sam")
  })

  it("only offers friends who aren't on the flare and sends the invite", async () => {
    const user = userEvent.setup()
    render(<EventGuestsSection eventId="e1" canInvite />)

    await user.click(
      await screen.findByRole("button", { name: /invite more/i })
    )
    await screen.findByPlaceholderText("search friends...")

    // Guest rows aren't buttons, so this only looks inside the friend picker.
    expect(
      screen.queryByRole("button", { name: /sam/ })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /lee/ }))
    await user.click(screen.getByRole("button", { name: "invite 1" }))

    expect(mocks.inviteEventGuests).toHaveBeenCalledWith("e1", {
      circles: [],
      members: [{ userId: "u-lee", role: "guest" }],
    })
    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("invited 1 friend")
    )
    expect(mocks.fetchEventGuests).toHaveBeenCalledTimes(2)
  })

  it("counts only circle members who are new to the flare", async () => {
    const user = userEvent.setup()
    render(<EventGuestsSection eventId="e1" canInvite />)

    await user.click(
      await screen.findByRole("button", { name: /invite more/i })
    )
    await user.click(
      await screen.findByRole("button", { name: /close friends/i })
    )

    // ana is in the circle but already going, so only lee is new.
    await user.click(screen.getByRole("button", { name: "invite 1" }))
    expect(mocks.inviteEventGuests).toHaveBeenCalledWith("e1", {
      circles: [{ circleId: "c-close", role: "guest" }],
      members: [],
    })
  })

  it("hides invite more when the flare can't take invites", async () => {
    render(<EventGuestsSection eventId="e1" canInvite={false} />)

    await screen.findByText("1 going · 1 invited")
    expect(
      screen.queryByRole("button", { name: /invite more/i })
    ).not.toBeInTheDocument()
  })
})
