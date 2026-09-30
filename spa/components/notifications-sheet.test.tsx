import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Notification } from "@/lib/notifications"
import {
  NotificationsSheet,
  sheetBottomOccupiedCss,
} from "./notifications-sheet"

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

function renderSheet(
  overrides: Partial<React.ComponentProps<typeof NotificationsSheet>> = {}
) {
  const onMarkAllRead = vi.fn()
  const onClose = vi.fn()
  const props: React.ComponentProps<typeof NotificationsSheet> = {
    open: true,
    onClose,
    notifications: [baseNotification],
    unreadCount: 1,
    hasMore: false,
    caughtUpAt: null,
    onMarkAllRead,
    ...overrides,
  }
  const view = render(<NotificationsSheet {...props} />)
  return { onMarkAllRead, onClose, view, props }
}

// #137: the feed is a vaul bottom sheet like the event detail sheet, not its
// own popover.
describe("NotificationsSheet presentation", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--sponti-bottom-occupied")
  })

  it("renders as a titled dialog with the drag handle's sheet styling, docked on the nav", () => {
    renderSheet()

    const dialog = screen.getByRole("dialog", { name: "notifications" })
    expect(dialog).toHaveClass("rounded-t-3xl", "bg-background")
    // Docked on the nav (#264): the sheet sits at the bottom of a clipping
    // frame whose bottom edge is the nav's top edge, so it slides in and out
    // from behind that edge instead of across the nav. jsdom has no layout, so
    // the wiring is asserted on the classes that produce it.
    const frame = dialog.parentElement
    expect(frame).toHaveClass(
      "fixed",
      "top-0",
      "overflow-hidden",
      "pointer-events-none",
      "bottom-[var(--sponti-nav-h,64px)]"
    )
    expect(dialog).toHaveClass("absolute", "bottom-0", "pointer-events-auto")
    // vaul's ::after would paint the sheet's background over the nav.
    expect(dialog).toHaveClass("after:hidden")
    // The scrim stops above the nav so the nav stays lit and tappable.
    const scrim = document.querySelector("[data-vaul-overlay]")
    expect(scrim?.className).toContain("bottom-[var(--sponti-nav-h,64px)]")
    expect(scrim).not.toHaveClass("inset-0")
    expect(screen.getByText("maya invited you")).toBeInTheDocument()
  })

  it("renders nothing while closed", () => {
    renderSheet({ open: false })

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows the unread count next to the title only when there is one", () => {
    const { view, props } = renderSheet({ unreadCount: 3 })
    expect(screen.getByText("3")).toBeInTheDocument()

    view.rerender(<NotificationsSheet {...props} unreadCount={0} />)
    expect(screen.queryByText("3")).not.toBeInTheDocument()
  })

  it("closes from the close button", async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()

    await user.click(
      screen.getByRole("button", { name: /close notifications/i })
    )

    expect(onClose).toHaveBeenCalled()
  })

  it("opens a notification when its row is tapped", async () => {
    const user = userEvent.setup()
    const onNotificationClick = vi.fn()
    renderSheet({ onNotificationClick })

    await user.click(screen.getByRole("button", { name: /maya invited you/i }))

    expect(onNotificationClick).toHaveBeenCalledWith(baseNotification)
  })

  it("keeps the list out of vaul's drag so scrolling it doesn't drag the sheet", () => {
    renderSheet()

    expect(screen.getByRole("list")).toHaveAttribute("data-vaul-no-drag")
  })

  it("keeps the empty state", () => {
    renderSheet({ notifications: [], unreadCount: 0 })

    expect(screen.getByText("no notifications yet")).toBeInTheDocument()
  })

  it("keeps the error message", () => {
    renderSheet({ error: "couldn't load notifications" })

    expect(screen.getByText("couldn't load notifications")).toBeInTheDocument()
  })

  // #112: the toast anchors on --sponti-bottom-occupied, so an open sheet has
  // to publish its own height there, and hand the variable back when it closes.
  it("publishes its footprint for the toast while open and restores the variable on close", () => {
    const root = document.documentElement
    root.style.setProperty("--sponti-bottom-occupied", "123px")
    const { view, props } = renderSheet()

    expect(root.style.getPropertyValue("--sponti-bottom-occupied")).toBe(
      sheetBottomOccupiedCss(0) // jsdom lays nothing out, so the height is 0
    )

    view.rerender(<NotificationsSheet {...props} open={false} />)
    expect(root.style.getPropertyValue("--sponti-bottom-occupied")).toBe(
      "123px"
    )
  })

  it("removes the variable on close when nothing had set it", () => {
    const { view, props } = renderSheet()
    view.rerender(<NotificationsSheet {...props} open={false} />)

    expect(
      document.documentElement.style.getPropertyValue(
        "--sponti-bottom-occupied"
      )
    ).toBe("")
  })
})

describe("sheetBottomOccupiedCss", () => {
  it("stacks the sheet on top of the nav", () => {
    expect(sheetBottomOccupiedCss(300)).toBe(
      "calc(var(--sponti-nav-h, 64px) + 300px)"
    )
  })
})

// The list's sentinel only exists once vaul has portalled the content in, a
// render after `open` flips; loading older pages depends on observing it then.
describe("NotificationsSheet paging", () => {
  it("asks for older notifications when the sentinel scrolls into view", () => {
    const trigger: { fire: (() => void) | null } = { fire: null }
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback) {
        trigger.fire = () =>
          cb(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          )
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver)
    const onLoadMore = vi.fn()

    renderSheet({ hasMore: true, onLoadMore })
    trigger.fire?.()

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

// #176: the check mark at the bottom of the feed used to be purely
// decorative — tapping it did nothing.
describe("NotificationsSheet caught up", () => {
  it("calls onMarkAllRead when the check mark is tapped, once fully loaded", async () => {
    const user = userEvent.setup()
    const { onMarkAllRead } = renderSheet()

    await user.click(screen.getByRole("button", { name: /mark all as seen/i }))

    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it("doesn't show the check mark while there are more notifications to load", () => {
    renderSheet({ hasMore: true })

    expect(
      screen.queryByRole("button", { name: /mark all as seen/i })
    ).not.toBeInTheDocument()
  })

  it("collapses the list into a caught-up state once caughtUpAt covers everything loaded", () => {
    renderSheet({
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
    renderSheet({
      caughtUpAt: "2026-09-28T12:30:00.000Z",
    })

    await user.click(screen.getByRole("button", { name: /show 1 earlier/i }))

    expect(screen.getByText("maya invited you")).toBeInTheDocument()
  })

  it("stays expanded when a notification is newer than the last caught-up moment", () => {
    renderSheet({
      caughtUpAt: "2026-09-28T11:00:00.000Z", // before the notification's createdAt
    })

    expect(screen.getByText("maya invited you")).toBeInTheDocument()
    expect(screen.queryByText(/you.re caught up/i)).not.toBeInTheDocument()
  })
})
