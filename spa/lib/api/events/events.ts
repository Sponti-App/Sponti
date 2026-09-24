import { apiFetch } from "@/lib/http"
import { adaptApiEvent, adaptApiHostedEvent } from "./events.adapter"
import type {
  ApiEvent,
  CreateEventRequest,
  CreateEventResponse,
  EventGuest,
  FetchCalendarEventsParams,
  FetchCalendarEventsResult,
  FetchMapEventsParams,
  InviteEventMembersRequest,
  InviteEventMembersResponse,
  MyFlaresResult,
  Paginated,
  RsvpStatus,
  UpdateEventRequest,
} from "./events.types"

/**
 * POST	/events
 * Posts a fully adapted event create payload and returns the backend event
 * plus EventMember rows. The create form currently awaits this as the API
 * success signal before writing its temporary local compatibility copy.
 */
export function createEvent(
  body: CreateEventRequest
): Promise<CreateEventResponse> {
  return apiFetch<{ data: CreateEventResponse }>("/events", {
    method: "POST",
    body,
  }).then((response) => response.data)
}

/**
 * GET /events/map/active
 * Loads active nearby events for the home map and converts backend documents
 * into the frontend EventItem shape.
 */
export function fetchMapEvents(params: FetchMapEventsParams) {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radiusKm: String(params.radiusKm ?? 25),
  })

  return apiFetch<{ data: ApiEvent[] }>(`/events/map/active?${query}`, {
    signal: params.signal,
  }).then((response) => response.data.map(adaptApiEvent))
}

/**
 * GET /events/calendar/upcoming
 * Loads upcoming events for the calendar view while preserving backend
 * pagination metadata.
 */
export function fetchCalendarEvents(
  params?: FetchCalendarEventsParams
): Promise<FetchCalendarEventsResult> {
  const query = new URLSearchParams()
  if (params?.page) query.set("page", String(params.page))
  if (params?.limit) query.set("limit", String(params.limit))
  const suffix = query.toString() ? `?${query}` : ""

  return apiFetch<Paginated<ApiEvent>>(`/events/calendar/upcoming${suffix}`, {
    signal: params?.signal,
  }).then((response) => ({
    items: response.data.map(adaptApiEvent),
    pagination: response.pagination,
  }))
}

/** GET /events/:id
 * Fetches one event and adapts it for detail surfaces that expect EventItem.
 */
export function fetchEventById(id: string, signal?: AbortSignal) {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}`, { signal }).then(
    (response) => adaptApiEvent(response.data)
  )
}

export function fetchMyHostedEvents(
  signal?: AbortSignal
): Promise<MyFlaresResult["hostedByMe"]> {
  return fetchMyFlares(signal).then((result) => result.hostedByMe)
}

export function fetchMyFlares(signal?: AbortSignal): Promise<MyFlaresResult> {
  const query = new URLSearchParams({
    endAtFrom: new Date().toISOString(),
  })

  return apiFetch<{
    data: {
      hostedByMe: ApiEvent[]
      invited: ApiEvent[]
      pastHosted?: ApiEvent[]
    }
  }>(`/events/mine/upcoming?${query}`, { signal }).then((response) => ({
    hostedByMe: response.data.hostedByMe.map(adaptApiHostedEvent),
    invited: response.data.invited.map(adaptApiHostedEvent),
    pastHosted: (response.data.pastHosted ?? []).map(adaptApiHostedEvent),
  }))
}

export function fetchHostedEventById(id: string, signal?: AbortSignal) {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}`, { signal }).then(
    (response) => adaptApiHostedEvent(response.data)
  )
}

export function updateEvent(id: string, body: UpdateEventRequest) {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}`, {
    method: "PATCH",
    body,
  }).then((response) => adaptApiHostedEvent(response.data))
}

export function cancelEvent(id: string) {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}/cancel`, {
    method: "PATCH",
  }).then((response) => adaptApiHostedEvent(response.data))
}

export function reactivateEvent(id: string) {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}/reactivate`, {
    method: "PATCH",
  }).then((response) => adaptApiHostedEvent(response.data))
}

/**
 * GET /events/:id/members
 * Host-only guest list (everyone but the host) with each guest's RSVP.
 */
export function fetchEventGuests(
  eventId: string,
  signal?: AbortSignal
): Promise<EventGuest[]> {
  return apiFetch<{ data: EventGuest[] }>(`/events/${eventId}/members`, {
    signal,
  }).then((response) => response.data)
}

/**
 * POST /events/:id/members
 * Invites more friends and circles to a posted flare. Only people who weren't
 * on the flare yet are added and notified; their ids come back.
 */
export function inviteEventGuests(
  eventId: string,
  body: InviteEventMembersRequest
): Promise<InviteEventMembersResponse> {
  return apiFetch<{ data: InviteEventMembersResponse }>(
    `/events/${eventId}/members`,
    { method: "POST", body }
  ).then((response) => response.data)
}

/**
 * Persists the current user's RSVP/arrival fields through the event membership
 * endpoint used by the home event detail sheet.
 */
export function updateMyRsvp(
  eventId: string,
  body: { rsvpStatus?: RsvpStatus; memberWillArriveAt?: string | null }
) {
  return apiFetch<{ data: unknown }>(`/events/${eventId}/me`, {
    method: "PATCH",
    body,
  })
}
