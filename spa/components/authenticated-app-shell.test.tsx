import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  loadLatest: vi.fn(),
  loadMore: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ status: "authenticated" }),
}))

vi.mock("@/components/new-event-drawer-provider", () => ({
  useNewEventDrawer: () => ({
    open: false,
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
  }),
}))

vi.mock("@/lib/use-notifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    loadLatest: mocks.loadLatest,
    loadMore: mocks.loadMore,
  }),
  useUnreadCountRefresh: () => {},
}))

vi.mock("@/lib/haptics", () => ({
  haptic: vi.fn(),
}))

vi.mock("@/components/bottom-nav", () => ({
  BottomNav: ({
    onOpenNotifications,
  }: {
    onOpenNotifications?: () => void
  }) => <button onClick={onOpenNotifications}>toggle feed</button>,
}))

vi.mock("@/components/notifications-popover", () => ({
  NotificationsPopover: ({ open }: { open: boolean }) =>
    open ? <div data-testid="notifications-feed" /> : null,
}))

import { AuthenticatedAppShell } from "./authenticated-app-shell"

describe("AuthenticatedAppShell notification feed", () => {
  beforeEach(() => {
    mocks.pathname = "/"
  })

  // #170: the feed's open state lived in the app shell, which stays mounted
  // across navigations. Leaving the page it was opened on and coming back
  // used to resurrect it open, even though the user never reopened it.
  it("closes the feed on navigation and stays closed on returning to the page it was opened on", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AuthenticatedAppShell>
        <div>page content</div>
      </AuthenticatedAppShell>
    )

    await user.click(screen.getByText("toggle feed"))
    expect(screen.getByTestId("notifications-feed")).toBeInTheDocument()

    // Navigate Home -> Circles. The shell stays mounted; only pathname changes.
    mocks.pathname = "/circles"
    rerender(
      <AuthenticatedAppShell>
        <div>page content</div>
      </AuthenticatedAppShell>
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId("notifications-feed")
      ).not.toBeInTheDocument()
    )

    // Navigate back to Home. The feed must not reopen on its own.
    mocks.pathname = "/"
    rerender(
      <AuthenticatedAppShell>
        <div>page content</div>
      </AuthenticatedAppShell>
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId("notifications-feed")
      ).not.toBeInTheDocument()
    )
  })
})
