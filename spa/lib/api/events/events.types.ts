export type EventVisibility = "public" | "private"
export type EventRsvp = "invited" | "going" | "declined"
export type EventType =
  | "food"
  | "drinks"
  | "sports"
  | "hangout"
  | "party"
  | "culture"
  | "hobby"
export type RsvpStatus = Extract<EventRsvp, "going" | "declined">
export type EventGuestInviteMode = "multiple" | "single" | "none"
export type EventInviteRole = "admin" | "guest"
export type ApiEventStatus = "active" | "cancelled" | "completed"

export interface EventItem {
  id: string
  hostId?: string
  title: string
  type: EventType
  startAt: string
  endAt: string
  visibility: EventVisibility
  myRsvp?: EventRsvp | null
  host: {
    id: string
    name: string
    avatar: string
    avatarUrl?: string | null
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
// A backend circle id when visibility is private. Circle tier labels such as
// "inner", "close", and "all" live on circle.type, not in this id field.
export type Audience = string

export type DraftEventLocation = {
  source: "place" | "current"
  name: string
  address?: string | null
  // GeoJSON order: [lng, lat]
  coordinates: [number, number]
  placeId?: string
}

export type DraftEvent = {
  mode: "now" | "scheduled"
  eventType: EventType
  title: string
  details?: string
  durationMinutes: number
  startOffsetMinutes?: number
  startDate?: string
  startTime?: string
  recurrence?: Recurrence
  whereType: "current" | "search" | "saved"
  location?: DraftEventLocation | null
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
  hostId?: string
  hostName?: string
  hostUsername?: string
  hostAvatarUrl?: string | null
  title: string
  description?: string
  type: EventType
  coverImageUrl?: string
  startAt: string
  endAt: string
  locationLabel: string
  locationDetail?: string
  audienceLabel: string
  attendeeCount: number
  attendingCount: number
  attendees?: Array<{
    id: string
    displayName: string
    username?: string
    avatarUrl?: string | null
  }>
  guestLimit: number
  myRsvp?: EventRsvp | null
  visibility: EventVisibility
  recurrence: Recurrence
  apiStatus: ApiEventStatus
  updatedAt: string
}

export type EventCoordinates = {
  lat: number
  lng: number
}

export type EventAudienceTarget =
  | { kind: "public" }
  // `extraMemberIds` rides along on top of the selected circle invite.
  | { kind: "circle"; circleId: string; extraMemberIds?: string[] }
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
  type: EventType
  coverImageUrl?: string | null
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

export type UpdateEventRequest = Partial<
  Pick<
    CreateEventRequest,
    | "title"
    | "description"
    | "type"
    | "startAt"
    | "endAt"
    | "locationName"
    | "locationAddress"
    | "location"
    | "visibility"
    | "allowGuestInvites"
    | "guestInviteLimit"
  >
>

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
  hostId:
    | string
    | {
        _id: string
        displayName?: string
        username?: string
        avatarUrl?: string | null
      }
  title: string
  description?: string | null
  type: EventType
  coverImageUrl?: string | null
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
  memberCount?: number
  goingCount?: number
  attendees?: Array<{
    _id: string
    displayName?: string
    username?: string
    avatarUrl?: string | null
  }>
  createdAt?: string
  updatedAt?: string
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

export type MyFlaresResult = {
  hostedByMe: HostedEvent[]
  invited: HostedEvent[]
  pastHosted: HostedEvent[]
}

export type MyFlaresState = MyFlaresResult & {
  loading: boolean
  error: string | null
  refresh: () => void
}

export type EventsState = {
  events: EventItem[]
  loading: boolean
  refreshing?: boolean
  error: string | null
  refresh: () => void
}
