"use client"

import { useEffect, useSyncExternalStore } from "react"
import {
  dismissNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationsReadBatch,
} from "@/lib/api/notifications"
import type { Notification } from "@/lib/notifications"
import { emitEventsChanged } from "@/lib/use-events"

type NotificationsState = {
  notifications: Notification[]
  nextCursor: string | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  unreadCount: number
  unreadCountLoaded: boolean
  // Set when the user last tapped "I'm caught up" (#176). The feed stays
  // collapsed while every loaded notification is no newer than this — once
  // something newer shows up, it's derived back open (see notifications-sheet).
  caughtUpAt: string | null
}

type NotificationsSnapshot = NotificationsState & {
  hasMore: boolean
  loadLatest: () => Promise<void>
  loadMore: () => Promise<void>
  refreshUnreadCount: () => Promise<void>
  markAllRead: () => Promise<void>
  dismiss: (notificationId: string) => Promise<void>
}

type Listener = () => void

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const PAGE_SIZE = 10
const READ_AFTER_SHOWN_MS = 900
// How often the unread badge re-checks while the app is visible (#157).
const UNREAD_POLL_MS = 30_000

const listeners = new Set<Listener>()
const pendingReadIds = new Set<string>()
// Rows swiped away this session (#173). The server persists the dismissal,
// but this keeps them hidden even if that call fails or a feed fetch that
// started before it lands afterwards.
const dismissedIds = new Set<string>()

function withoutDismissed(notifications: Notification[]): Notification[] {
  return notifications.filter(
    (notification) => !dismissedIds.has(notification.id)
  )
}

let state: NotificationsState = {
  notifications: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  unreadCount: 0,
  unreadCountLoaded: false,
  caughtUpAt: null,
}
let cachedSnapshot: NotificationsSnapshot | null = null

function apiEnabled(): boolean {
  return API_BASE.length > 0
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function setState(
  next:
    | NotificationsState
    | ((current: NotificationsState) => NotificationsState)
): void {
  state = typeof next === "function" ? next(state) : next
  cachedSnapshot = null
  notify()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): NotificationsSnapshot {
  if (cachedSnapshot) return cachedSnapshot

  cachedSnapshot = {
    ...state,
    hasMore: state.nextCursor !== null,
    loadLatest,
    loadMore,
    refreshUnreadCount,
    markAllRead,
    dismiss,
  }

  return cachedSnapshot
}

function serverSnapshot(): NotificationsSnapshot {
  return {
    notifications: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: null,
    unreadCount: 0,
    unreadCountLoaded: false,
    caughtUpAt: null,
    hasMore: false,
    loadLatest,
    loadMore,
    refreshUnreadCount,
    markAllRead,
    dismiss,
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Failed to load notifications"
}

function mergeAppendedNotifications(
  current: Notification[],
  nextBatch: Notification[]
): Notification[] {
  const seen = new Set(current.map((notification) => notification.id))
  return [
    ...current,
    ...nextBatch.filter((notification) => !seen.has(notification.id)),
  ]
}

function scheduleReadBatch(batch: Notification[]): void {
  if (!apiEnabled()) return

  const ids = batch
    .filter((notification) => !notification.read)
    .map((notification) => notification.id)
    .filter((id) => {
      if (pendingReadIds.has(id)) return false
      pendingReadIds.add(id)
      return true
    })

  if (ids.length === 0) return

  window.setTimeout(() => {
    markNotificationsReadBatch(ids)
      .then(({ unreadCount }) => {
        const readAt = new Date().toISOString()
        setState((current) => ({
          ...current,
          unreadCount,
          notifications: current.notifications.map((notification) =>
            ids.includes(notification.id)
              ? { ...notification, read: true, readAt }
              : notification
          ),
        }))
      })
      .catch((err) => {
        console.warn("[Sponti] failed to mark notifications read", err)
      })
      .finally(() => {
        ids.forEach((id) => pendingReadIds.delete(id))
      })
  }, READ_AFTER_SHOWN_MS)
}

export async function refreshUnreadCount(): Promise<void> {
  if (!apiEnabled()) return

  try {
    const count = await fetchUnreadNotificationCount()
    // A higher count than last time means a notification arrived since we
    // last checked — often about something another account did (an
    // accepted request, an rsvp). Nudge the events store so lists and
    // counts catch up without waiting for a remount (#197).
    if (state.unreadCountLoaded && count > state.unreadCount) {
      emitEventsChanged()
    }
    setState((current) => ({
      ...current,
      unreadCount: count,
      unreadCountLoaded: true,
    }))
  } catch (err) {
    console.warn("[Sponti] failed to load unread notification count", err)
    setState((current) => ({
      ...current,
      unreadCountLoaded: true,
    }))
  }
}

export async function loadLatest(): Promise<void> {
  if (!apiEnabled()) return

  setState((current) => ({
    ...current,
    loading: true,
    error: null,
  }))

  try {
    const result = await fetchNotifications({ limit: PAGE_SIZE })
    const notifications = withoutDismissed(result.notifications)
    setState((current) => ({
      ...current,
      notifications,
      nextCursor: result.pagination.nextCursor,
      loading: false,
      error: null,
    }))
    scheduleReadBatch(notifications)
  } catch (err) {
    setState((current) => ({
      ...current,
      loading: false,
      error: errMessage(err),
    }))
  }
}

export async function loadMore(): Promise<void> {
  if (!apiEnabled() || state.loadingMore || !state.nextCursor) return

  const cursor = state.nextCursor
  setState((current) => ({
    ...current,
    loadingMore: true,
    error: null,
  }))

  try {
    const result = await fetchNotifications({ limit: PAGE_SIZE, cursor })
    const notifications = withoutDismissed(result.notifications)
    setState((current) => ({
      ...current,
      notifications: mergeAppendedNotifications(
        current.notifications,
        notifications
      ),
      nextCursor: result.pagination.nextCursor,
      loadingMore: false,
      error: null,
    }))
    scheduleReadBatch(notifications)
  } catch (err) {
    setState((current) => ({
      ...current,
      loadingMore: false,
      error: errMessage(err),
    }))
  }
}

// "I'm caught up" (#176): marks every current notification read on the
// server — not only what's been paged into `notifications` — and records
// when, so the feed can collapse. Optimistically marks the loaded page read
// too, rather than waiting on the next fetch.
export async function markAllRead(): Promise<void> {
  if (!apiEnabled()) return

  try {
    const { unreadCount } = await markAllNotificationsRead()
    const readAt = new Date().toISOString()
    setState((current) => ({
      ...current,
      unreadCount,
      caughtUpAt: readAt,
      notifications: current.notifications.map((notification) =>
        notification.read
          ? notification
          : { ...notification, read: true, readAt }
      ),
    }))
  } catch (err) {
    console.warn("[Sponti] failed to mark all notifications read", err)
    // Surface it: the check mark otherwise looks dead when the call fails.
    setState((current) => ({
      ...current,
      error: "couldn't mark as read, try again",
    }))
  }
}

// Swipe-left on a feed row (#173): hides it, optimistically, and persists
// that. Never declines anything — a connection request stays pending.
export async function dismiss(notificationId: string): Promise<void> {
  dismissedIds.add(notificationId)
  setState((current) => {
    const target = current.notifications.find(
      (notification) => notification.id === notificationId
    )
    return {
      ...current,
      notifications: current.notifications.filter(
        (notification) => notification.id !== notificationId
      ),
      unreadCount:
        target && !target.read
          ? Math.max(0, current.unreadCount - 1)
          : current.unreadCount,
    }
  })

  if (!apiEnabled()) return

  try {
    const { unreadCount } = await dismissNotification(notificationId)
    setState((current) => ({ ...current, unreadCount }))
  } catch (err) {
    // Still hidden for this session (dismissedIds); it may come back on a
    // later launch, which beats un-hiding it under the user's thumb now.
    console.warn("[Sponti] failed to dismiss notification", err)
  }
}

export function useNotifications(): NotificationsSnapshot {
  const store = useSyncExternalStore(subscribe, snapshot, serverSnapshot)

  useEffect(() => {
    if (!apiEnabled() || store.unreadCountLoaded) return
    void refreshUnreadCount()
  }, [store.unreadCountLoaded])

  return store
}

export function useUnreadNotificationCount(): number {
  return useNotifications().unreadCount
}

/**
 * Keeps the unread badge fresh while the app stays open: re-checks when the tab
 * or app regains focus and on a slow timer while it's visible. Mount it once
 * (the app shell does); the count itself is shared through the store.
 */
export function useUnreadCountRefresh(): void {
  useEffect(() => {
    if (!apiEnabled()) return

    const refreshIfVisible = (): void => {
      if (document.visibilityState === "visible") void refreshUnreadCount()
    }

    const timer = window.setInterval(refreshIfVisible, UNREAD_POLL_MS)
    document.addEventListener("visibilitychange", refreshIfVisible)
    window.addEventListener("focus", refreshIfVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refreshIfVisible)
      window.removeEventListener("focus", refreshIfVisible)
    }
  }, [])
}
