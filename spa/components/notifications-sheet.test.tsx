import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Notification } from "@/lib/notifications"
import { NotificationsSheet } from "./notifications-sheet"

const baseNotification: Notification = {
  id: "n1",
  type: "event_invitation",
  targetType: "event",
  targetId: "e1",
  title: "maya invited you",
  subtitle: "to friday drinks",
  createdAt: "2026-09-28T12:00:00.000Z",
  readAt: null,
  read: false,
  href: "/event",
  intent: "event",
  actorName: "maya",
}

function renderPopover(
  overrides: Partial<React.ComponentProps<typeof NotificationsSheet>> = {}
) {
  const onMarkAllRead = vi.fn()
  const props: React.ComponentProps<typeof NotificationsSheet> = {
    open: true,
    onClose: vi.fn(),
    notifications: [baseNotification],
    unreadCount: 1,
    hasMore: false,
    caughtUpAt: null,
    onMarkAllRead,
    ...overrides,
  }
  render(<NotificationsSheet {...props} />)
  return { onMarkAllRead }
}

// #176: the check mark at the bottom of the feed used to be purely
// decorative — tapping it did nothing.
describe("NotificationsSheet caught up", () => {
  it("calls onMarkAllRead when the check mark is tapped, once fully loaded", async () => {
    const user = userEvent.setup()
    const { onMarkAllRead } = renderPopover()

    await user.click(screen.getByRole("button", { name: /mark all as seen/i }))

    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it("doesn't show the check mark while there are more notifications to load", () => {
    renderPopover({ hasMore: true })

    expect(
      screen.queryByRole("button", { name: /mark all as seen/i })
    ).not.toBeInTheDocument()
  })

  it("collapses the list into a caught-up state once caughtUpAt covers everything loaded", () => {
    renderPopover({
      caughtUpAt: "2026-09-28T12:30:00.000Z", // after the notification's createdAt
    })

    expect(screen.getByText(/you.re caught up/i)).toBeInTheDocument()
    expect(screen.queryByText("maya invited you")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /mark all as seen/i })
    ).not.toBeInTheDocument()
  })

  it("lets the user show the collapsed list again without waiting for something new", async () => {
    const user = userEvent.setup()
    renderPopover({
      caughtUpAt: "2026-09-28T12:30:00.000Z",
    })

    await user.click(screen.getByRole("button", { name: /show 1 earlier/i }))

    expect(screen.getByText("maya invited you")).toBeInTheDocument()
  })

  it("stays expanded when a notification is newer than the last caught-up moment", () => {
    renderPopover({
      caughtUpAt: "2026-09-28T11:00:00.000Z", // before the notification's createdAt
    })

    expect(screen.getByText("maya invited you")).toBeInTheDocument()
    expect(screen.queryByText(/you.re caught up/i)).not.toBeInTheDocument()
  })
})
