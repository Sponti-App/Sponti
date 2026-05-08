// Frontend notification feed. Shape mirrors what the api/ server will return —
// a flattened view of event_members + events + users — so the UI can swap to
// a real fetch with no changes here.

export type NotificationType = "invitation" | "rsvp" | "confirmation" | "event_update"
export type RsvpStatus = "yes" | "no" | "maybe"
export type EventChangeKind = "time" | "location" | "cancelled" | "removed"

export type Notification = {
  id: string
  type: NotificationType
  // Display name of the user who triggered the notification
  // (inviter for invitation, responder for rsvp/confirmation, host for event_update).
  actorName: string
  // Title of the event in question.
  eventTitle: string
  // Required when type === "rsvp".
  rsvp?: RsvpStatus
  // Set when type === "event_update". Multiple kinds may collapse into one
  // notification when changes happen close together (batching window).
  changes?: EventChangeKind[]
  // Set when type === "event_update" and one of the changes is "time" or "location".
  changeDetail?: string
  // ISO datetime — used for relative formatting and ordering.
  createdAt: string
  read: boolean
}

const BATCH_WINDOW_MS = 90_000

// Push an event-update notification, collapsing into a recent unread entry for
// the same event when within the batching window. "cancelled" events never
// batch — they get their own notification.
export function pushEventUpdate(
  list: Notification[],
  payload: {
    actorName: string
    eventTitle: string
    change: EventChangeKind
    detail?: string
  },
): Notification[] {
  const now = Date.now()
  const cutoff = now - BATCH_WINDOW_MS

  if (payload.change !== "cancelled") {
    const recent = list.find(
      (n) =>
        n.type === "event_update" &&
        !n.read &&
        n.eventTitle === payload.eventTitle &&
        new Date(n.createdAt).getTime() > cutoff &&
        !(n.changes ?? []).includes("cancelled"),
    )
    if (recent) {
      const merged: Notification = {
        ...recent,
        actorName: payload.actorName,
        changes: Array.from(new Set([...(recent.changes ?? []), payload.change])),
        changeDetail:
          payload.change === recent.changes?.[0]
            ? payload.detail ?? recent.changeDetail
            : recent.changeDetail,
        createdAt: new Date(now).toISOString(),
      }
      return list.map((n) => (n.id === recent.id ? merged : n))
    }
  }

  const next: Notification = {
    id: `n-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type: "event_update",
    actorName: payload.actorName,
    eventTitle: payload.eventTitle,
    changes: [payload.change],
    changeDetail: payload.detail,
    createdAt: new Date(now).toISOString(),
    read: false,
  }
  return [next, ...list]
}

const NOW = Date.now()
const minutesAgo = (m: number): string => new Date(NOW - m * 60_000).toISOString()
const hoursAgo = (h: number): string => minutesAgo(h * 60)

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "invitation",
    actorName: "Lin",
    eventTitle: "rooftop drinks",
    createdAt: minutesAgo(5),
    read: false,
  },
  {
    id: "n2",
    type: "rsvp",
    actorName: "Maya",
    eventTitle: "patio hang",
    rsvp: "yes",
    createdAt: minutesAgo(22),
    read: false,
  },
  {
    id: "n3",
    type: "confirmation",
    actorName: "Maria",
    eventTitle: "patio hang",
    createdAt: hoursAgo(1),
    read: false,
  },
  {
    id: "n4",
    type: "rsvp",
    actorName: "Jordan",
    eventTitle: "studio session",
    rsvp: "maybe",
    createdAt: hoursAgo(3),
    read: true,
  },
  {
    id: "n5",
    type: "invitation",
    actorName: "Sam",
    eventTitle: "morning run",
    createdAt: hoursAgo(6),
    read: true,
  },
]

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
