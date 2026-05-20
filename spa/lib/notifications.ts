import type {
  ApiNotification,
  ApiNotificationType,
} from "@/lib/api/notifications"

export type NotificationIntent =
  | "connection"
  | "event"
  | "success"
  | "warning"
  | "rsvp"

export type Notification = {
  id: string
  type: ApiNotificationType
  targetType: ApiNotification["targetType"]
  targetId: string
  title: string
  subtitle: string
  createdAt: string
  readAt: string | null
  read: boolean
  href: string
  intent: NotificationIntent
  actorName: string | null
}

const EVENT_NOTIFICATION_TYPES: ApiNotificationType[] = [
  "event_invitation",
  "event_cancelled",
  "event_reactivated",
  "event_rsvp_change",
]

function actorName(notification: ApiNotification): string | null {
  const actor = notification.actor
  return actor?.displayName || actor?.username || null
}

function hrefFor(type: ApiNotificationType): string {
  if (type === "connection_request" || type === "connection_accepted") {
    return "/circles?tab=people"
  }

  return "/event"
}

function intentFor(type: ApiNotificationType): NotificationIntent {
  switch (type) {
    case "connection_request":
      return "connection"
    case "connection_accepted":
      return "success"
    case "event_cancelled":
      return "warning"
    case "event_rsvp_change":
      return "rsvp"
    case "event_invitation":
    case "event_reactivated":
      return "event"
  }
}

export function adaptApiNotification(
  notification: ApiNotification
): Notification {
  const isEventNotification = EVENT_NOTIFICATION_TYPES.includes(
    notification.type
  )

  return {
    id: notification._id,
    type: notification.type,
    targetType: notification.targetType,
    targetId: notification.targetId,
    title: notification.title,
    subtitle:
      notification.message || (isEventNotification ? "tap to view" : ""),
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    read: notification.readAt !== null,
    href: hrefFor(notification.type),
    intent: intentFor(notification.type),
    actorName: actorName(notification),
  }
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}
