"use client"

import { useEffect, useSyncExternalStore } from "react"
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsReadBatch,
} from "@/lib/api/notifications"
import type { Notification } from "@/lib/notifications"

type NotificationsState = {
  notifications: Notification[]
  nextCursor: string | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  unreadCount: number
  unreadCountLoaded: boolean
}

type NotificationsSnapshot = NotificationsState & {
  hasMore: boolean
  loadLatest: () => Promise<void>
  loadMore: () => Promise<void>
  refreshUnreadCount: () => Promise<void>
}

type Listener = () => void

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const PAGE_SIZE = 10
const READ_AFTER_SHOWN_MS = 900

const listeners = new Set<Listener>()
const pendingReadIds = new Set<string>()

let state: NotificationsState = {
  notifications: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  unreadCount: 0,
  unreadCountLoaded: false,
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
    hasMore: false,
    loadLatest,
    loadMore,
    refreshUnreadCount,
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
    setState((current) => ({
      ...current,
      notifications: result.notifications,
      nextCursor: result.pagination.nextCursor,
      loading: false,
      error: null,
    }))
    scheduleReadBatch(result.notifications)
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
    setState((current) => ({
      ...current,
      notifications: mergeAppendedNotifications(
        current.notifications,
        result.notifications
      ),
      nextCursor: result.pagination.nextCursor,
      loadingMore: false,
      error: null,
    }))
    scheduleReadBatch(result.notifications)
  } catch (err) {
    setState((current) => ({
      ...current,
      loadingMore: false,
      error: errMessage(err),
    }))
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
