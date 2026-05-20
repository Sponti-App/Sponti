import { apiFetch } from "@/lib/http"
import { adaptApiNotification, type Notification } from "@/lib/notifications"

export type ApiNotificationType =
  | "event_invitation"
  | "event_reactivated"
  | "event_cancelled"
  | "connection_request"
  | "connection_accepted"
  | "event_rsvp_change"

export type ApiNotificationTargetType = "event" | "connection" | "user"

export type ApiNotificationActor = {
  _id: string
  username: string
  displayName?: string
  avatarUrl?: string | null
}

export type ApiNotification = {
  _id: string
  userId: string
  actorId: string | null
  type: ApiNotificationType
  targetType: ApiNotificationTargetType
  targetId: string
  title: string
  message: string
  readAt: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  actor: ApiNotificationActor | null
}

type FetchNotificationsResponse = {
  data: ApiNotification[]
  pagination: {
    nextCursor: string | null
  }
}

type FetchNotificationsParams = {
  limit?: number
  cursor?: string | null
  signal?: AbortSignal
}

export type FetchNotificationsResult = {
  notifications: Notification[]
  pagination: {
    nextCursor: string | null
  }
}

export function fetchNotifications({
  limit = 10,
  cursor,
  signal,
}: FetchNotificationsParams = {}): Promise<FetchNotificationsResult> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (cursor) query.set("cursor", cursor)

  return apiFetch<FetchNotificationsResponse>(`/notifications?${query}`, {
    signal,
  }).then((response) => ({
    notifications: response.data.map(adaptApiNotification),
    pagination: response.pagination,
  }))
}

export function fetchUnreadNotificationCount(
  signal?: AbortSignal
): Promise<number> {
  return apiFetch<{ data: { count: number } }>("/notifications/unread-count", {
    signal,
  }).then((response) => response.data.count)
}

export function markNotificationsReadBatch(
  notificationIds: string[]
): Promise<{ markedRead: number; unreadCount: number }> {
  return apiFetch<{ data: { markedRead: number; unreadCount: number } }>(
    "/notifications/read-batch",
    {
      method: "PATCH",
      body: { notificationIds },
    }
  ).then((response) => response.data)
}
