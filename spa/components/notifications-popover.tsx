"use client"

import { useEffect, useRef } from "react"
import {
  Bell,
  Check,
  Flame,
  Loader2,
  RotateCcw,
  Sparkles,
  UserCheck,
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
  onLoadMore,
  onNotificationClick,
}: {
  open: boolean
  onClose: () => void
  notifications: Notification[]
  unreadCount: number
  loading?: boolean
  loadingMore?: boolean
  error?: string | null
  hasMore?: boolean
  onLoadMore?: () => void
  onNotificationClick?: (notification: Notification) => void
}) {
  const scrollRef = useRef<HTMLUListElement | null>(null)
  const sentinelRef = useRef<HTMLLIElement | null>(null)

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

  return (
    <>
      <div
        className={`absolute inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`absolute right-3 bottom-22 left-3 z-50 mx-auto max-w-90 origin-bottom overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg transition-all duration-200 ${
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
        ) : (
          <ul
            ref={scrollRef}
            className="max-h-[360px] divide-y divide-border overflow-y-auto"
          >
            {notifications.map((notification) => {
              const { icon: Icon, ring } = TYPE_VISUAL[notification.type]
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => onNotificationClick?.(notification)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary ${
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

        {notifications.length > 0 && !hasMore && !loadingMore && (
          <div className="border-t border-border px-4 py-3 text-center">
            <Check className="mx-auto h-4 w-4 text-muted-foreground" />
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
