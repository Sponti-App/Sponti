export type EventVisibility = "public" | "private"
export type EventType = "coffee" | "hang" | "run"
export type EventRsvp = "invited" | "going" | "maybe" | "declined"
export type RsvpStatus = Extract<EventRsvp, "going" | "maybe" | "declined">
export type EventGuestInviteMode = "multiple" | "single" | "none"
export type EventInviteRole = "admin" | "guest"
export type ApiEventStatus = "active" | "cancelled" | "completed"

export interface EventItem {
  id: string
  title: string
  type: EventType
  startAt: string
  endAt: string
  visibility: EventVisibility
  myRsvp?: EventRsvp | null
  host: {
    name: string
    avatar: string
    color: string
    note: string
  }
  location: {
    name: string
    area?: string
    address?: string
    coordinates?: [number, number]
  }
  attendees: Array<{ name: string; avatar: string; color: string }>
  going: number
}

export type Recurrence = "none" | "daily" | "weekly"
// A circle id (e.g. "inner", "close", "all", or a custom-NNN id) OR the
// literal "custom" for the ad-hoc friend-picker path.
export type Audience = string
export type DraftEventType = "food" | "drinks" | "sports" | "hangout"

export type DraftEvent = {
  mode: "now" | "scheduled"
  eventType: DraftEventType
  title: string
  details?: string
  durationMinutes: number
  startOffsetMinutes?: number
  startDate?: string
  startTime?: string
  recurrence?: Recurrence
  whereType: "current" | "search" | "saved"
  customWhere?: string
  savedPlaceLabel?: string
  guestLimit: number | null
  audience: Audience
  selectedFriendIds?: string[]
  customListName?: string
  visibility: EventVisibility
  allowForward: boolean
  allowPlusOne: boolean
  createdAt: string
}

export type HostedEventStatus = "live" | "upcoming" | "past" | "cancelled"
export type EventStatus = HostedEventStatus

export type HostedEvent = {
  id: string
  title: string
  description?: string
  startAt: string
  endAt: string
  locationLabel: string
  locationDetail?: string
  audienceLabel: string
  // Resolved member ids — backed by event_members.userId on the server.
  attendeeIds: string[]
  // Subset who said yes (rsvpStatus === "yes").
  attendingIds: string[]
  visibility: EventVisibility
  recurrence: Recurrence
  cancelledAt?: string
  updatedAt: string
}

export type EventCoordinates = {
  lat: number
  lng: number
}

export type EventAudienceTarget =
  | { kind: "public" }
  | { kind: "circle"; circleId: string }
  | { kind: "members"; memberIds: string[] }

export type EventTimeRange = {
  startAt: string
  endAt: string
}

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
  status: ApiEventStatus
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

export type EventsState = {
  events: EventItem[]
  loading: boolean
  error: string | null
  refresh: () => void
}
