// API client for the events service in `api/`. Each method matches a route
// declared in api/src/routes/eventRoutes.ts. Responses are mapped from the
// backend `Event` document shape to the UI `EventItem` shape via
// `adaptApiEvent` below.

import { apiFetch } from "../http"
import type { EventItem, EventRsvp, EventType, EventVisibility } from "../events"

// Backend response shape — keep loose; we only consume the fields the UI needs.
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
  status: "active" | "cancelled" | "completed"
  // Caller's RSVP. Backend attaches this via `attachMyRsvp` in
  // api/src/services/eventService.ts on /events/map/active and
  // /events/calendar/upcoming. `null` when the caller has no membership row.
  myRsvp?: EventRsvp | null
  // Optional aggregations the backend may include — not required by the UI.
  goingCount?: number
  attendees?: Array<{ _id: string; displayName?: string; username?: string }>
}

export type Paginated<T> = {
  data: T[]
  pagination: { page: number; limit: number; total: number; pageCount: number }
}

// ---- adapter ----

const TYPE_KEYWORDS: Array<{ test: RegExp; type: EventType }> = [
  { test: /coffee|latte|espresso|brunch|breakfast/i, type: "coffee" },
  { test: /run|jog|hike|cycle|ride/i, type: "run" },
]

function inferType(title: string): EventType {
  for (const { test, type } of TYPE_KEYWORDS) if (test.test(title)) return type
  return "hang"
}

function hostFromApi(host: ApiEvent["hostId"]): EventItem["host"] {
  if (typeof host === "string") {
    return { name: "host", avatar: "?", color: "bg-stone-400", note: "" }
  }
  const name = host.displayName || host.username || "host"
  return {
    name,
    avatar: name.charAt(0).toUpperCase(),
    color: "bg-stone-400",
    note: "",
  }
}

export function adaptApiEvent(api: ApiEvent): EventItem {
  return {
    id: api._id,
    title: api.title,
    type: inferType(api.title),
    startAt: api.startAt,
    endAt: api.endAt,
    visibility: api.visibility,
    myRsvp: api.myRsvp ?? null,
    host: hostFromApi(api.hostId),
    location: {
      name: api.locationName,
      address: api.locationAddress ?? undefined,
      coordinates: api.location?.coordinates,
    },
    attendees: (api.attendees ?? []).map((a) => {
      const name = a.displayName || a.username || "guest"
      return { name, avatar: name.charAt(0).toUpperCase(), color: "bg-stone-300" }
    }),
    going: api.goingCount ?? api.attendees?.length ?? 0,
  }
}

// Convert a "let host know" chip label ("5 min" / "15 min" / "30 min" / "1 hr")
// to an ISO timestamp the backend stores on `EventMember.memberWillArriveAt`.
// Returning `null` clears the field. Unrecognized strings also return null —
// safer than guessing and writing a wrong arrival time.
export function etaToIso(eta: string | null): string | null {
  if (!eta) return null
  const trimmed = eta.trim().toLowerCase()
  const match = /^(\d+)\s*(min|hr|hour|hours|h)$/.exec(trimmed)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2]
  const minutes = unit === "min" ? value : value * 60
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

// ---- methods ----

export function fetchMapEvents(params: {
  lat: number
  lng: number
  radiusKm?: number
  signal?: AbortSignal
}): Promise<EventItem[]> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radiusKm: String(params.radiusKm ?? 25),
  })
  return apiFetch<{ data: ApiEvent[] }>(`/events/map/active?${q}`, {
    signal: params.signal,
  }).then((r) => r.data.map(adaptApiEvent))
}

export function fetchCalendarEvents(params?: {
  page?: number
  limit?: number
  signal?: AbortSignal
}): Promise<{ items: EventItem[]; pagination: Paginated<unknown>["pagination"] }> {
  const q = new URLSearchParams()
  if (params?.page) q.set("page", String(params.page))
  if (params?.limit) q.set("limit", String(params.limit))
  const suffix = q.toString() ? `?${q}` : ""
  return apiFetch<Paginated<ApiEvent>>(`/events/calendar/upcoming${suffix}`, {
    signal: params?.signal,
  }).then((r) => ({
    items: r.data.map(adaptApiEvent),
    pagination: r.pagination,
  }))
}

export function fetchEventById(id: string, signal?: AbortSignal): Promise<EventItem> {
  return apiFetch<{ data: ApiEvent }>(`/events/${id}`, { signal }).then((r) =>
    adaptApiEvent(r.data),
  )
}

export type RsvpStatus = "going" | "maybe" | "declined"

export function updateMyRsvp(
  eventId: string,
  body: { rsvpStatus?: RsvpStatus; memberWillArriveAt?: string | null },
) {
  return apiFetch<{ data: unknown }>(`/events/${eventId}/me`, {
    method: "PATCH",
    body,
  })
}
