import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventGuestsSection } from "./event-guests-section"

const mocks = vi.hoisted(() => ({
  showActionFeedback: vi.fn(),
  fetchEventGuests: vi.fn(),
  inviteEventGuests: vi.fn(),
  removeEventGuest: vi.fn(),
  fetchMyCircles: vi.fn(),
  fetchAcceptedConnections: vi.fn(),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: mocks.showActionFeedback }),
}))

vi.mock("@/lib/api/events", () => ({
  fetchEventGuests: mocks.fetchEventGuests,
  inviteEventGuests: mocks.inviteEventGuests,
  removeEventGuest: mocks.removeEventGuest,
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
    mocks.removeEventGuest.mockResolvedValue({
      removedUserId: "u-sam",
      notified: false,
    })
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

  // #172: the "invite more" picker reuses the composer's CircleCards, which
  // used to filter custom circles out entirely.
  it("offers a custom circle in the invite-more picker and invites its members", async () => {
    mocks.fetchMyCircles.mockResolvedValue([
      {
        id: "c-close",
        name: "close friends",
        description: "",
        type: "close",
        memberIds: ["u-ana", "u-lee"],
      },
      {
        id: "c-book-club",
        name: "book club",
        description: "custom circle",
        type: "custom",
        memberIds: ["u-lee"],
      },
    ])
    const user = userEvent.setup()
    render(<EventGuestsSection eventId="e1" canInvite />)

    await user.click(
      await screen.findByRole("button", { name: /invite more/i })
    )
    const customChip = await screen.findByRole("button", {
      name: /book club/i,
    })
    expect(customChip).toHaveTextContent("1")
    await user.click(customChip)

    await user.click(screen.getByRole("button", { name: "invite 1" }))
    expect(mocks.inviteEventGuests).toHaveBeenCalledWith("e1", {
      circles: [{ circleId: "c-book-club", role: "guest" }],
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

  // #148: removing a guest is quiet for someone who hasn't committed, and
  // slower for someone who said they're going (they'll be told).
  describe("removing a guest", () => {
    it("removes an invited guest straight away, without a confirm step", async () => {
      const user = userEvent.setup()
      render(<EventGuestsSection eventId="e1" canInvite canRemove />)

      await user.click(
        await screen.findByRole("button", { name: "remove sam" })
      )

      expect(mocks.removeEventGuest).toHaveBeenCalledWith("e1", "u-sam")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      await waitFor(() =>
        expect(mocks.showActionFeedback).toHaveBeenCalledWith("removed sam")
      )
      // The list is reloaded so they disappear from it.
      expect(mocks.fetchEventGuests).toHaveBeenCalledTimes(2)
    })

    it("asks first when the guest said they're going, and only removes on confirm", async () => {
      const user = userEvent.setup()
      render(<EventGuestsSection eventId="e1" canInvite canRemove />)

      await user.click(
        await screen.findByRole("button", { name: "remove ana" })
      )
      expect(
        screen.getByRole("dialog", { name: "remove ana?" })
      ).toBeInTheDocument()
      expect(mocks.removeEventGuest).not.toHaveBeenCalled()

      await user.click(screen.getByRole("button", { name: "keep them" }))
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(mocks.removeEventGuest).not.toHaveBeenCalled()

      await user.click(screen.getByRole("button", { name: "remove ana" }))
      await user.click(screen.getByRole("button", { name: "remove" }))
      expect(mocks.removeEventGuest).toHaveBeenCalledWith("e1", "u-ana")
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      )
    })

    it("says so when removing fails", async () => {
      const user = userEvent.setup()
      mocks.removeEventGuest.mockRejectedValue(new Error("nope"))
      render(<EventGuestsSection eventId="e1" canInvite canRemove />)

      await user.click(
        await screen.findByRole("button", { name: "remove sam" })
      )

      await waitFor(() =>
        expect(mocks.showActionFeedback).toHaveBeenCalledWith(
          "couldn't remove sam",
          { tone: "error" }
        )
      )
    })

    it("offers no remove buttons once the guest list is locked", async () => {
      render(<EventGuestsSection eventId="e1" canInvite canRemove={false} />)

      await screen.findByText("1 going · 1 invited")
      expect(
        screen.queryByRole("button", { name: /^remove / })
      ).not.toBeInTheDocument()
    })
  })
})
