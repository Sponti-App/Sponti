import type {
  ApiNotification,
  ApiNotificationType,
  ApiRsvpChangeMetadata,
} from "@/lib/api/notifications"

export type NotificationIntent =
  | "connection"
  | "event"
  | "success"
  | "warning"
  | "rsvp"

// #414: an `event_rsvp_change`, read from its metadata so nothing has to
// parse the copy. `change` is null for a notification written before #414:
// it might be a join or only an arrival update, so never treat it as a join.
export type RsvpChange = {
  change: "joined" | "declined" | "arrival_updated" | null
  status: "going" | "declined" | null
  // The first join the host ever heard about on this flare (server-side).
  firstJoin: boolean
  eventTitle: string | null
  // A minute-based arrival time (ISO) or a near-term answer, never both.
  willArriveAt: string | null
  arrivalStatus: "on_time" | "running_late" | null
}

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
  // The user who caused it. For a connection_request that's the requester,
  // who the feed's circle chips add to a circle after accepting (#226).
  actorId?: string | null
  // The actor's photo, when they have one (#414). Name and photo are visible
  // to anyone, so this is safe on every notification.
  actorAvatarUrl?: string | null
  // Set on `event_rsvp_change` only (#414).
  rsvp?: RsvpChange
}

const EVENT_NOTIFICATION_TYPES: ApiNotificationType[] = [
  "event_invitation",
  "event_cancelled",
  "event_reactivated",
  "event_rsvp_change",
  "event_guest_removed",
  "event_update",
]

function actorName(notification: ApiNotification): string | null {
  const actor = notification.actor
  return actor?.displayName || actor?.username || null
}

const RSVP_CHANGES = ["joined", "declined", "arrival_updated"] as const
const RSVP_STATUSES = ["going", "declined"] as const
const ARRIVAL_STATUSES = ["on_time", "running_late"] as const

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

/**
 * Reads an `event_rsvp_change`'s metadata (#414). Defensive about every
 * field, so a notification from before #414, or from an api that's ahead of
 * or behind this build, still parses: anything missing or unknown comes back
 * null (or false for `firstJoin`).
 */
export function parseRsvpChange(
  notification: ApiNotification
): RsvpChange | undefined {
  if (notification.type !== "event_rsvp_change") return undefined

  // Typed by key, but every value unchecked until read below.
  const metadata = (notification.metadata ?? {}) as Partial<
    Record<keyof ApiRsvpChangeMetadata, unknown>
  >
  const change = oneOf(metadata.rsvpChange, RSVP_CHANGES)

  return {
    change,
    status: oneOf(metadata.rsvpStatus, RSVP_STATUSES),
    firstJoin: change === "joined" && metadata.firstJoin === true,
    eventTitle: stringOrNull(metadata.eventTitle),
    willArriveAt: stringOrNull(metadata.memberWillArriveAt),
    arrivalStatus: oneOf(metadata.arrivalStatus, ARRIVAL_STATUSES),
  }
}

/** A notification telling the host that someone joined their flare (#414). */
export function isJoinNotification(notification: Notification): boolean {
  return notification.rsvp?.change === "joined"
}

function hrefFor(notification: ApiNotification): string {
  const { type } = notification
  if (type === "connection_request" || type === "connection_accepted") {
    return "/circles?tab=people"
  }

  // A thread update opens the flare on its updates tab (#140, #139).
  if (type === "event_update") {
    return `/event/${notification.targetId}?tab=updates`
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
    case "event_guest_removed":
    case "event_update":
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
    href: hrefFor(notification),
    intent: intentFor(notification.type),
    actorName: actorName(notification),
    actorId: notification.actorId,
    actorAvatarUrl: notification.actor?.avatarUrl ?? null,
    rsvp: parseRsvpChange(notification),
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
