"use client"

import { useEffect, useRef, useState } from "react"
import {
  Bell,
  Check,
  ChevronDown,
  Flame,
  Loader2,
  MessageSquare,
  RotateCcw,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react"
import { formatRelative, type Notification } from "@/lib/notifications"

type Visual = {
  icon: LucideIcon
  ring: string
}

const TYPE_VISUAL: Record<Notification["type"], Visual> = {
  event_invitation: { icon: Flame, ring: "border-accent/30 text-accent" },
  event_cancelled: {
    icon: X,
    ring: "border-destructive/40 text-destructive",
  },
  event_reactivated: {
    icon: RotateCcw,
    ring: "border-accent/30 text-accent",
  },
  event_rsvp_change: {
    icon: Sparkles,
    ring: "border-foreground/15 text-foreground",
  },
  event_guest_removed: {
    icon: UserMinus,
    ring: "border-foreground/15 text-muted-foreground",
  },
  event_update: {
    icon: MessageSquare,
    ring: "border-accent/30 text-accent",
  },
  connection_request: {
    icon: UserPlus,
    ring: "border-accent/30 text-accent",
  },
  connection_accepted: {
    icon: UserCheck,
    ring: "border-accent/30 text-accent",
  },
}

export function NotificationsPopover({
  open,
  onClose,
  notifications,
  unreadCount,
  loading,
  loadingMore,
  error,
  hasMore,
  caughtUpAt,
  onLoadMore,
  onNotificationClick,
  onMarkAllRead,
}: {
  open: boolean
  onClose: () => void
  notifications: Notification[]
  unreadCount: number
  loading?: boolean
  loadingMore?: boolean
  error?: string | null
  hasMore?: boolean
  caughtUpAt?: string | null
  onLoadMore?: () => void
  onNotificationClick?: (notification: Notification) => void
  onMarkAllRead?: () => void
}) {
  const scrollRef = useRef<HTMLUListElement | null>(null)
  const sentinelRef = useRef<HTMLLIElement | null>(null)
  // Lets the user peek at the collapsed feed again without waiting for a new
  // notification to arrive. Local and ephemeral: it resets on close so the
  // feed shows caught-up again the next time there's nothing new (#176).
  const [manuallyExpanded, setManuallyExpanded] = useState(false)

  useEffect(() => {
    if (open) return
    const timeout = window.setTimeout(() => {
      setManuallyExpanded(false)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open || !hasMore || !onLoadMore) return
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore()
        }
      },
      { root, rootMargin: "80px 0px", threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, hasMore, onLoadMore, notifications.length])

  // "I'm caught up" collapses the feed once everything loaded is no newer
  // than the moment it was tapped. A notification newer than that reopens it
  // — derived here rather than stored, so it needs no separate reset (#176).
  const hasNewSinceCaughtUp =
    caughtUpAt != null &&
    notifications.some(
      (notification) =>
        new Date(notification.createdAt).getTime() >
        new Date(caughtUpAt).getTime()
    )
  const isCaughtUp =
    caughtUpAt != null && notifications.length > 0 && !hasNewSinceCaughtUp
  const showCollapsed = isCaughtUp && !manuallyExpanded

  const handleMarkAllRead = () => {
    setManuallyExpanded(false)
    onMarkAllRead?.()
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed right-3 bottom-[calc(var(--sponti-nav-h,64px)+1.5rem)] left-3 z-50 mx-auto max-w-90 origin-bottom overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg transition-all duration-200 ${
          open
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            loading
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              no notifications yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              invites and rsvps will land here
            </p>
          </div>
        ) : showCollapsed ? (
          <div className="px-4 py-10 text-center">
            <Check className="mx-auto h-5 w-5 text-accent" />
            <p className="mt-2 text-sm font-medium">you&rsquo;re caught up</p>
            <button
              type="button"
              onClick={() => setManuallyExpanded(true)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              show {notifications.length} earlier
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <ul
            ref={scrollRef}
            className="max-h-90 divide-y divide-border overflow-y-auto"
          >
            {notifications.map((notification) => {
              const { icon: Icon, ring } = TYPE_VISUAL[notification.type]
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => onNotificationClick?.(notification)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary active:bg-muted ${
                      notification.read ? "" : "bg-accent/5"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background ${ring}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {notification.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {notification.subtitle}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(notification.createdAt)}
                      </span>
                      {!notification.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                    </div>
                  </button>
                </li>
              )
            })}

            <li ref={sentinelRef}>
              <div className="flex min-h-11 items-center justify-center px-4 py-3 text-xs text-muted-foreground">
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    loading older
                  </span>
                ) : hasMore ? (
                  <span>scroll for older</span>
                ) : (
                  <span>caught up</span>
                )}
              </div>
            </li>
          </ul>
        )}

        {error && (
          <div className="border-t border-border px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {notifications.length > 0 && !hasMore && !loadingMore && !showCollapsed && (
          <div className="border-t border-border px-4 py-3 text-center">
            <button
              type="button"
              onClick={handleMarkAllRead}
              aria-label="Mark all as seen"
              className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        )}

        {notifications.length === 0 && !loading && (
          <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
            <Bell className="mx-auto h-4 w-4" />
          </div>
        )}
      </div>
    </>
  )
}
