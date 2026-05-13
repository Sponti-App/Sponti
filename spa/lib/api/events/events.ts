import { apiFetch } from "@/lib/http"
import { adaptApiEvent } from "./events.adapter"
import type {
  ApiEvent,
  CreateEventRequest,
  CreateEventResponse,
  FetchCalendarEventsParams,
  FetchCalendarEventsResult,
  FetchMapEventsParams,
  Paginated,
} from "./events.types"

/**
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

/**
 * Fetches one event and adapts it for detail surfaces that expect EventItem.
 */
export function fetchEventById(id: string, signal?: AbortSignal) {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}`, { signal }).then(
    (response) => adaptApiEvent(response.data)
  )
}

export type RsvpStatus = "going" | "maybe" | "declined"

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

export { etaToIso } from "./events.adapter"
export type * from "./events.types"
