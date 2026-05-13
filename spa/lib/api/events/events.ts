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

export function createEvent(
  body: CreateEventRequest
): Promise<CreateEventResponse> {
  return apiFetch<{ data: CreateEventResponse }>("/events", {
    method: "POST",
    body,
  }).then((response) => response.data)
}

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

export function fetchEventById(id: string, signal?: AbortSignal) {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}`, { signal }).then(
    (response) => adaptApiEvent(response.data)
  )
}

export type RsvpStatus = "going" | "maybe" | "declined"

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
