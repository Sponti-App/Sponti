import type {
  ApiEvent,
  CreateEventRequest,
  DraftEvent,
  EventAudienceTarget,
  EventCoordinates,
  EventGuestInviteMode,
  EventItem,
  EventStatus,
  EventTimeRange,
  HostedEvent,
} from "./events.types"

const MIN = 60_000
const DAY = 24 * 60 * MIN

export function isJoined(event: EventItem, joinedIds: Set<string>): boolean {
  return event.myRsvp === "going" || joinedIds.has(event.id)
}

export function isImminent(
  event: EventItem,
  now: number = Date.now()
): boolean {
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  return now >= start - 30 * MIN && now <= end
}

export function isLive(event: EventItem, now: number = Date.now()): boolean {
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  return now >= start && now <= end
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function eventDayKey(event: EventItem): string {
  return dayKey(new Date(event.startAt))
}

export function formatEventTime(event: EventItem): string {
  return new Date(event.startAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatRelativeStatus(
  event: EventItem,
  now: number = Date.now()
): string {
  const start = new Date(event.startAt).getTime()
  if (isLive(event, now)) return "happening now"
  const diffMs = start - now
  if (diffMs < 0) return "ended"
  const diffMin = Math.round(diffMs / MIN)
  if (diffMin < 60) return `in ${diffMin} min`
  const sameDay = dayKey(new Date(start)) === dayKey(new Date(now))
  if (sameDay) return formatEventTime(event)
  const tomorrowKey = dayKey(new Date(now + DAY))
  if (dayKey(new Date(start)) === tomorrowKey)
    return `${formatEventTime(event)} tomorrow`
  return new Date(start).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function avatarText(bgColor: string): string {
  return bgColor === "bg-accent" || bgColor === "bg-stone-800"
    ? "text-accent-foreground"
    : "text-foreground"
}

const EARTH_RADIUS_M = 6_371_000

function haversineMeters(a: EventCoordinates, b: EventCoordinates): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function distanceFromUser(
  event: EventItem,
  user: EventCoordinates | null
): { meters: number; label: string } | null {
  if (!user || !event.location.coordinates) return null
  const [lng, lat] = event.location.coordinates
  const meters = haversineMeters(user, { lat, lng })
  return { meters, label: formatDistance(meters) }
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.344
  if (miles < 0.1) return `${Math.round(meters)} m`
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

export function walkTimeLabel(meters: number): string {
  const minutes = Math.max(1, Math.round(meters / 80))
  if (minutes < 60) return `${minutes} min walk`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours} hr walk` : `${hours}h ${rem}m walk`
}

export function eventCoords(event: EventItem): EventCoordinates | null {
  if (!event.location.coordinates) return null
  const [lng, lat] = event.location.coordinates
  return { lat, lng }
}

function hostFromApi(host: ApiEvent["hostId"]): EventItem["host"] {
  if (typeof host === "string") {
    return { id: host, name: "host", avatar: "?", color: "bg-stone-400", note: "" }
  }
  const name = host.displayName || host.username || "host"
  return {
    id: host._id,
    name,
    avatar: name.charAt(0).toUpperCase(),
    color: "bg-stone-400",
    note: "",
  }
}

/**
 * Converts a backend event document into the EventItem shape consumed by the
 * home map/calendar UI.
 */
export function adaptApiEvent(api: ApiEvent): EventItem {
  const hostId =
    typeof api.hostId === "string" ? api.hostId : api.hostId?._id
  return {
    id: api._id,
    hostId,
    title: api.title,
    type: api.type,
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
      return {
        name,
        avatar: name.charAt(0).toUpperCase(),
        color: "bg-stone-300",
      }
    }),
    going: api.goingCount ?? api.attendees?.length ?? 0,
  }
}

/**
 * Converts a backend event into the hosted-dashboard shape used by /event and
 * /event/[id]/edit, including member counts and backend status.
 */
export function adaptApiHostedEvent(api: ApiEvent): HostedEvent {
  return {
    id: api._id,
    title: api.title,
    description: api.description ?? undefined,
    startAt: api.startAt,
    endAt: api.endAt,
    locationLabel: api.locationName,
    locationDetail: api.locationAddress ?? undefined,
    audienceLabel: api.visibility,
    attendeeCount: api.memberCount ?? api.attendees?.length ?? 0,
    attendingCount: api.goingCount ?? 0,
    visibility: api.visibility,
    recurrence: "none",
    apiStatus: api.status,
    updatedAt: api.updatedAt ?? api.startAt,
  }
}

/**
 * Derives the UI display bucket from event time and backend status.
 */
export function deriveStatus(
  event: HostedEvent,
  currentTime: number = Date.now()
): EventStatus {
  if (event.apiStatus === "cancelled") return "cancelled"
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  if (currentTime >= start && currentTime <= end) return "live"
  if (currentTime < start) return "upcoming"
  return "past"
}

/**
 * Infers the edit form's date/time inputs from a hosted event's ISO range.
 */
export function inferEventStartShape(event: HostedEvent): {
  mode: "now" | "scheduled"
  startOffsetMinutes?: number
  startDate?: string
  startTime?: string
  durationMinutes: number
} {
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / MIN)
  const diffMin = Math.round((start.getTime() - Date.now()) / MIN)

  if (diffMin >= 0 && diffMin <= 360) {
    return { mode: "now", startOffsetMinutes: diffMin, durationMinutes }
  }

  const yyyy = start.getFullYear()
  const mm = String(start.getMonth() + 1).padStart(2, "0")
  const dd = String(start.getDate()).padStart(2, "0")
  const hh = String(start.getHours()).padStart(2, "0")
  const mi = String(start.getMinutes()).padStart(2, "0")

  return {
    mode: "scheduled",
    startDate: `${yyyy}-${mm}-${dd}`,
    startTime: `${hh}:${mi}`,
    durationMinutes,
  }
}

/**
 * Maps the create-event sharing toggles to the backend guest-invite mode.
 */
export function guestInviteModeFromDraft(
  draft: DraftEvent
): EventGuestInviteMode {
  if (draft.visibility === "public") return "none"
  if (draft.allowForward) return "multiple"
  if (draft.allowPlusOne) return "single"
  return "none"
}

function locationFromDraft(
  draft: DraftEvent
): Pick<CreateEventRequest, "locationName" | "locationAddress" | "location"> {
  const draftLocation = draft.location
  if (!draftLocation) {
    throw new Error("Create event requires a resolved location.")
  }

  const locationName = draftLocation.name.trim()
  if (!locationName) {
    throw new Error("Create event requires a named location.")
  }

  const [lng, lat] = draftLocation.coordinates
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    throw new Error("Create event requires valid location coordinates.")
  }

  const locationAddress = draftLocation.address?.trim() || null

  return {
    locationName,
    locationAddress,
    location: {
      type: "Point",
      coordinates: [lng, lat],
    },
  }
}

/**
 * Derives ISO start/end timestamps from the draft when the caller does not
 * provide the exact range already computed by the form.
 */
export function timeRangeFromDraft(draft: DraftEvent): EventTimeRange {
  let startMs: number

  if (draft.mode === "now") {
    startMs =
      new Date(draft.createdAt).getTime() +
      (draft.startOffsetMinutes ?? 0) * MIN
  } else if (draft.startDate && draft.startTime) {
    startMs = new Date(`${draft.startDate}T${draft.startTime}`).getTime()
  } else {
    startMs = new Date(draft.createdAt).getTime()
  }

  const endMs = startMs + draft.durationMinutes * MIN
  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
  }
}

/**
 * Builds the POST /events request body from the create-event draft plus the
 * resolved audience target.
 */
export function createEventRequestFromDraft(
  draft: DraftEvent,
  audience: EventAudienceTarget,
  timeRange: EventTimeRange = timeRangeFromDraft(draft)
): CreateEventRequest {
  const isPublic = draft.visibility === "public"
  const target = isPublic ? { kind: "public" as const } : audience

  return {
    title: draft.title.trim() || draft.eventType,
    description: draft.details?.trim() ? draft.details.trim() : null,
    type: draft.eventType,
    startAt: timeRange.startAt,
    endAt: timeRange.endAt,
    ...locationFromDraft(draft),
    visibility: draft.visibility,
    allowGuestInvites: guestInviteModeFromDraft(draft),
    guestInviteLimit: draft.guestLimit ?? 0,
    circles:
      target.kind === "circle"
        ? [{ circleId: target.circleId, role: "guest" }]
        : [],
    members:
      target.kind === "members"
        ? target.memberIds.map((userId) => ({ userId, role: "guest" }))
        : target.kind === "circle" && target.extraMemberIds
          ? target.extraMemberIds.map((userId) => ({
            userId,
            role: "guest" as const,
          }))
          : [],
  }
}

/**
 * Converts compact ETA labels from the detail sheet into an ISO arrival time
 * for the RSVP endpoint.
 */
export function etaToIso(eta: string | null): string | null {
  if (!eta) return null
  const trimmed = eta.trim().toLowerCase()
  const match = /^(\d+)\s*(min|hr|hour|hours|h)$/.exec(trimmed)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2]
  const minutes = unit === "min" ? value : value * 60
  return new Date(Date.now() + minutes * MIN).toISOString()
}
