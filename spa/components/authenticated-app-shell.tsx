"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { NotificationsPopover } from "@/components/notifications-popover"
import { useAuth } from "@/components/auth-provider"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import type { Notification } from "@/lib/notifications"
import { useNotifications } from "@/lib/use-notifications"
import { haptic } from "@/lib/haptics"

const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]

function hidesAuthenticatedChrome(pathname: string): boolean {
  return (
    AUTH_PATHS.includes(pathname) ||
    pathname === "/event/new" ||
    pathname.startsWith("/qr/") ||
    pathname.startsWith("/api/")
  )
}

export function AuthenticatedAppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { status } = useAuth()
  const pathname = usePathname()

  if (status !== "authenticated" || hidesAuthenticatedChrome(pathname)) {
    return <>{children}</>
  }

  return <AuthenticatedChrome>{children}</AuthenticatedChrome>
}

function AuthenticatedChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { open: drawerOpen } = useNewEventDrawer()
  const [notificationsState, setNotificationsState] = useState(() => ({
    open: false,
    pathname,
  }))
  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    error,
    hasMore,
    loadLatest,
    loadMore,
  } = useNotifications()
  const notificationsOpen =
    notificationsState.open && notificationsState.pathname === pathname

  useEffect(() => {
    if (!drawerOpen) return
    const timeout = window.setTimeout(() => {
      setNotificationsState((current) => ({ ...current, open: false }))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [drawerOpen])

  const handleOpenNotifications = () => {
    const next = !notificationsOpen
    if (next) {
      void loadLatest()
    }
    setNotificationsState({ open: next, pathname })
  }

  const closeNotifications = () => {
    setNotificationsState((current) => ({ ...current, open: false }))
  }

  const handleNotificationClick = (notification: Notification) => {
    haptic("selection")
    closeNotifications()
    router.push(notification.href)
  }

  return (
    <>
      {children}
      <NotificationsPopover
        open={notificationsOpen}
        onClose={closeNotifications}
        notifications={notifications}
        unreadCount={unreadCount}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        hasMore={hasMore}
        onLoadMore={() => void loadMore()}
        onNotificationClick={handleNotificationClick}
      />
      <div className="fixed inset-x-0 bottom-0 z-40">
        <BottomNav
          onOpenNotifications={handleOpenNotifications}
          notificationsUnread={unreadCount}
        />
      </div>
    </>
  )
}
