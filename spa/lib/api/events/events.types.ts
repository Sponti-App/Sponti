export type EventVisibility = "public" | "private"
export type EventRsvp = "invited" | "going" | "declined"
// #211: the near-term "on time" / "running late" answer, offered instead of a
// minute-based memberWillArriveAt while a flare hasn't started but starts
// within the hour. Mutually exclusive with the timestamp on the api.
export type ArrivalStatus = "on_time" | "running_late"
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
    // Lets the detail sheet link to /profile/[username] (#199). Absent for
    // mock data and when the api only sent the host's id.
    username?: string
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
  attendees: Array<{
    id?: string
    name: string
    // Links the guest to /profile/[username]; absent when the api sent none.
    username?: string
    avatar: string
    color: string
    // Only ever populated for the host — see api's `attachEventPeople`.
    // Absent (not just null) for any other viewer.
    willArriveAt?: string | null
    // #211: the near-term alternative to willArriveAt. Same host-only rule.
    arrivalStatus?: ArrivalStatus | null
  }>
  going: number
}

export type Recurrence = "none" | "daily" | "weekly"
// A backend circle id when one is selected. The compose drawer uses "" as the
// no-circle-selected sentinel for private events with direct member invites.
// Circle tier labels such as "inner", "close", and "all" live on circle.type,
// not in this id field.
export type Audience = string

export type DraftEventLocation = {
  source: "place" | "current"
  name: string
  address?: string | null
  // GeoJSON order: [lng, lat]
  coordinates: [number, number]
  placeId?: string
  // Google's primaryType for a picked place. Only names an untitled flare
  // (#494); it is not sent to the api.
  placeType?: string
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
  // The flare's pin, for the detail page's map hero and "open in maps" (#139).
  coordinates?: EventCoordinates
  audienceLabel: string
  attendeeCount: number
  attendingCount: number
  attendees?: Array<{
    id: string
    displayName: string
    username?: string
    avatarUrl?: string | null
    // Only ever populated for the host — see api's `attachEventPeople`.
    // Absent (not just null) for any other viewer.
    willArriveAt?: string | null
    // #211: the near-term alternative to willArriveAt. Same host-only rule.
    arrivalStatus?: ArrivalStatus | null
  }>
  guestLimit: number
  // #181: the limit is a hard cap only while this is "none" (no +1/re-share).
  // Once a host turns on +1 or re-share, it becomes approximate — the host
  // can't know how many extra people that brings — so the api stops
  // enforcing it and the display should say so ("about N spots").
  allowGuestInvites?: EventGuestInviteMode
  myRsvp?: EventRsvp | null
  // #140: how many updates the flare's thread has. Anyone who can see the
  // flare gets it; only the host and going guests can read the updates.
  updateCount?: number
  // #139: the viewer's own arrival time. Only on the single-event response.
  myWillArriveAt?: string | null
  // #211: the viewer's own near-term arrival status, mutually exclusive with
  // myWillArriveAt. Only on the single-event response.
  myArrivalStatus?: ArrivalStatus | null
  visibility: EventVisibility
  recurrence: Recurrence
  apiStatus: ApiEventStatus
  createdAt: string
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

export type InviteEventMembersRequest = {
  members?: EventMemberInviteRequest[]
  circles?: EventCircleInviteRequest[]
}

export type RemoveEventGuestResponse = {
  removedUserId: string
  /** True when the guest had said "going" and was told they were removed. */
  notified: boolean
}

export type InviteEventMembersResponse = {
  invitedUserIds: string[]
}

/** One row of a flare's guest list, as returned to its host. */
export type EventGuest = {
  user: {
    _id: string
    displayName?: string
    username?: string
    avatarUrl?: string | null
  }
  role: EventInviteRole
  rsvpStatus: EventRsvp
  /** Joined a public flare on their own instead of being invited. */
  joinedWithoutInvite: boolean
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
    // Only present when the caller is this event's host (#90).
    willArriveAt?: string | null
    // Only present when the caller is this event's host (#211).
    arrivalStatus?: ArrivalStatus | null
  }>
  // Only on the single-event response (#140).
  updateCount?: number
  // The caller's own arrival time. Only on the single-event response (#139).
  myWillArriveAt?: string | null
  // The caller's own near-term arrival status. Only on the single-event
  // response (#211).
  myArrivalStatus?: ArrivalStatus | null
  createdAt?: string
  updatedAt?: string
}

/** One update in a flare's thread (#140), as returned by the api. */
export type EventUpdate = {
  _id: string
  eventId: string
  authorId: string
  author: {
    _id: string
    displayName?: string
    username?: string
    avatarUrl?: string | null
  }
  body: string
  createdAt: string
  /** True when the viewer is the author or the flare's host. */
  canDelete: boolean
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
