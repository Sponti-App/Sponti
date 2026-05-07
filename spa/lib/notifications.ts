// Frontend notification feed. Shape mirrors what the api/ server will return —
// a flattened view of event_members + events + users — so the UI can swap to
// a real fetch with no changes here.

export type NotificationType = "invitation" | "rsvp" | "confirmation"
export type RsvpStatus = "yes" | "no" | "maybe"

export type Notification = {
  id: string
  type: NotificationType
  // Display name of the user who triggered the notification
  // (inviter for invitation, responder for rsvp/confirmation).
  actorName: string
  // Title of the event in question.
  eventTitle: string
  // Required when type === "rsvp".
  rsvp?: RsvpStatus
  // ISO datetime — used for relative formatting and ordering.
  createdAt: string
  read: boolean
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
