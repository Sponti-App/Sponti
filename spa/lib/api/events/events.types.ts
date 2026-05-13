import type { EventItem, EventRsvp, EventVisibility } from "@/lib/events"

export type EventGuestInviteMode = "multiple" | "single" | "none"
export type EventInviteRole = "admin" | "guest"

export type EventMemberInviteRequest = {
  userId: string
  role?: EventInviteRole
}

export type EventCircleInviteRequest = {
  circleId: string
  role?: EventInviteRole
}

export type CreateEventRequest = {
  title: string
  description?: string | null
  startAt: string
  endAt: string
  locationName: string
  locationAddress?: string | null
  location: {
    type: "Point"
    coordinates: [number, number]
  }
  visibility?: EventVisibility
  allowGuestInvites?: EventGuestInviteMode
  guestInviteLimit?: number
  members?: EventMemberInviteRequest[]
  circles?: EventCircleInviteRequest[]
}

export type ApiEventMember = {
  _id: string
  eventId: string
  userId: string
  role: "host" | EventInviteRole
  rsvpStatus: EventRsvp
  canInviteGuests?: boolean
}

export type ApiEvent = {
  _id: string
  hostId: string | { _id: string; displayName?: string; username?: string }
  title: string
  description?: string | null
  startAt: string
  endAt: string
  locationName: string
  locationAddress?: string | null
  location: { type: "Point"; coordinates: [number, number] }
  visibility: EventVisibility
  allowGuestInvites: EventGuestInviteMode
  guestInviteLimit: number
  status: "active" | "cancelled" | "completed"
  myRsvp?: EventRsvp | null
  goingCount?: number
  attendees?: Array<{ _id: string; displayName?: string; username?: string }>
}

export type CreateEventResponse = {
  event: ApiEvent
  members: ApiEventMember[]
}

export type Paginated<T> = {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export type FetchMapEventsParams = {
  lat: number
  lng: number
  radiusKm?: number
  signal?: AbortSignal
}

export type FetchCalendarEventsParams = {
  page?: number
  limit?: number
  signal?: AbortSignal
}

export type FetchCalendarEventsResult = {
  items: EventItem[]
  pagination: Paginated<unknown>["pagination"]
}
