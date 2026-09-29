"use client"

import { useEffect, useRef, useState } from "react"
import { Drawer } from "vaul"
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
import { haptic } from "@/lib/haptics"

// Published on <html> while the sheet is open: the distance from the viewport
// bottom to the top of the sheet, so the action-feedback toast sits above it
// instead of on top of it (#112). Same contract the map view writes (see
// bottomOccupiedCss in map-view.tsx).
const BOTTOM_OCCUPIED_VAR = "--sponti-bottom-occupied"

export function sheetBottomOccupiedCss(sheetHeightPx: number): string {
  // The sheet sits directly on the nav, so both are docked at the bottom.
  return `calc(var(--sponti-nav-h, 64px) + ${sheetHeightPx}px)`
}

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

export function NotificationsSheet({
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
  // The sheet's content mounts a render after `open` flips (vaul portals it),
  // so these are state rather than refs: the effects below have to re-run
  // once the elements actually exist.
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null)
  const [scrollEl, setScrollEl] = useState<HTMLUListElement | null>(null)
  const [sentinelEl, setSentinelEl] = useState<HTMLLIElement | null>(null)
  // Lets the user peek at the collapsed feed again without waiting for a new
  // notification to arrive. Local and ephemeral: it resets on close so the
  // feed shows caught-up again the next time there's nothing new (#176).
  const [manuallyExpanded, setManuallyExpanded] = useState(false)

  // Haptic on open, like the event detail sheet.
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) haptic("light")
    prevOpen.current = open
  }, [open])

  useEffect(() => {
    if (open) return
    const timeout = window.setTimeout(() => {
      setManuallyExpanded(false)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open || !hasMore || !onLoadMore || !scrollEl || !sentinelEl) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore()
        }
      },
      { root: scrollEl, rootMargin: "80px 0px", threshold: 0.1 }
    )

    observer.observe(sentinelEl)
    return () => observer.disconnect()
  }, [open, hasMore, onLoadMore, notifications.length, scrollEl, sentinelEl])

  // Keep the toast above the sheet while it is open (#112). The map view is
  // the other writer of this variable; put back whatever it had on close.
  useEffect(() => {
    if (!open || !sheetEl) return
    const root = document.documentElement
    const previous = root.style.getPropertyValue(BOTTOM_OCCUPIED_VAR)
    const write = () =>
      root.style.setProperty(
        BOTTOM_OCCUPIED_VAR,
        sheetBottomOccupiedCss(sheetEl.offsetHeight)
      )
    write()
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(write)
    observer?.observe(sheetEl)
    return () => {
      observer?.disconnect()
      if (previous) root.style.setProperty(BOTTOM_OCCUPIED_VAR, previous)
      else root.style.removeProperty(BOTTOM_OCCUPIED_VAR)
    }
  }, [open, sheetEl])

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
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          haptic("light")
          onClose()
        }
      }}
      dismissible
      // No inputs in the feed, and the sheet is pinned to the nav with CSS.
      // Leaving vaul's keyboard repositioning on would let it write its own
      // `bottom` over ours (see new-event-drawer.tsx).
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        {/* Docked on the nav rather than over it. The cap is measured against
            the visible viewport (--sponti-vvh, see use-viewport-metrics) so
            the top stays within thumb reach on iOS Safari, where `vh` is the
            large viewport. `after:hidden` turns off the ::after vaul adds to
            hide the gap under a dragged sheet: it extends the background 200%
            below the sheet, which would paint straight over the nav. */}
        <Drawer.Content
          ref={setSheetEl}
          className="fixed inset-x-0 bottom-[var(--sponti-nav-h,64px)] z-50 flex after:hidden max-h-[calc(0.7*var(--sponti-vvh,100vh)-var(--sponti-nav-h,64px))] flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) outline-none"
        >
          {/* Drag handle — vaul attaches its gesture here automatically */}
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 pt-1 pb-3">
            <div className="flex items-center gap-2">
              <Drawer.Title className="text-lg font-semibold">
                notifications
              </Drawer.Title>
              {unreadCount > 0 && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Drawer.Description className="sr-only">
            invites, rsvps and updates from your flares
          </Drawer.Description>

          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              loading
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
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
                className="mt-3 inline-flex min-h-11 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                show {notifications.length} earlier
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            // The list scrolls on its own; without data-vaul-no-drag a scroll
            // gesture would drag the whole sheet. Same as the event detail
            // sheet, and it keeps row gestures (#173) free of vaul's drag.
            <ul
              ref={setScrollEl}
              data-vaul-no-drag
              className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain"
            >
              {notifications.map((notification) => {
                const { icon: Icon, ring } = TYPE_VISUAL[notification.type]
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => onNotificationClick?.(notification)}
                      className={`flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted ${
                        notification.read ? "" : "bg-accent/5"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background ${ring}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            notification.read
                              ? "text-muted-foreground"
                              : "font-medium"
                          }`}
                        >
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

              <li ref={setSentinelEl}>
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
            <div className="shrink-0 border-t border-border/60 px-4 py-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {notifications.length > 0 &&
            !hasMore &&
            !loadingMore &&
            !showCollapsed && (
              <div className="shrink-0 border-t border-border/60 px-4 py-2">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  aria-label="Mark all as seen"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Check className="h-4 w-4" />
                  mark all as seen
                </button>
              </div>
            )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
