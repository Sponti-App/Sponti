import { displayLocationName } from "@/lib/current-location"
import { formatDistance } from "@/lib/format-distance"
import { formatClock, formatWeekdayClock } from "@/lib/format-date"
import type {
  ApiEvent,
  ArrivalStatus,
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

// Mirrors the api's MAP_SOON_WINDOW_MS (api/src/services/eventService.ts) —
// how far a flare's start can be from now and still show up on the map
// right away, rather than only on the calendar.
export const MAP_SOON_WINDOW_MS = DAY

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
  return formatClock(event.startAt)
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
  return formatWeekdayClock(start)
}

/**
 * A relative arrival label for a going attendee's ETA ("arriving in 12 min"),
 * shown only to the host (see api's `attachEventPeople`). Relative rather
 * than a clock time so it stays correct against the viewer's own clock
 * without needing a timezone from the server.
 */
export function formatArrivalStatus(
  willArriveAt: string,
  now: number = Date.now()
): string {
  const diffMin = Math.round((new Date(willArriveAt).getTime() - now) / MIN)
  if (diffMin <= 0) return "should be there"
  if (diffMin < 60) return `arriving in ${diffMin} min`
  const hours = Math.round(diffMin / 60)
  return hours <= 1
    ? "arriving in about 1 hr"
    : `arriving in about ${hours} hrs`
}

/**
 * "on time" / "running late" — the host-facing label for a going attendee's
 * near-term arrival status (#211), shown instead of formatArrivalStatus while
 * a flare hasn't started but starts within the hour.
 */
export function arrivalStatusLabel(status: ArrivalStatus): string {
  return status === "on_time" ? "on time" : "running late"
}

export function avatarText(bgColor: string): string {
  return bgColor === "bg-accent" || bgColor === "bg-stone-800"
    ? "text-accent-foreground"
    : "text-foreground"
}

const EARTH_RADIUS_M = 6_371_000

/** Straight-line distance between two points, in meters. */
export function haversineMeters(
  a: EventCoordinates,
  b: EventCoordinates
): number {
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

export { formatDistance }

export function walkTimeLabel(meters: number): string {
  const minutes = Math.max(1, Math.round(meters / 80))
  if (minutes < 60) return `${minutes} min walk`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours} hr walk` : `${hours}h ${rem}m walk`
}

function coordinatesFromApi(
  location: ApiEvent["location"] | undefined
): EventCoordinates | undefined {
  const [lng, lat] = location?.coordinates ?? []
  if (typeof lat !== "number" || typeof lng !== "number") return undefined
  return { lat, lng }
}

export function eventCoords(event: EventItem): EventCoordinates | null {
  if (!event.location.coordinates) return null
  const [lng, lat] = event.location.coordinates
  return { lat, lng }
}

function hostFromApi(host: ApiEvent["hostId"]): EventItem["host"] {
  if (typeof host === "string") {
    return {
      id: host,
      name: "Host",
      avatar: "H",
      avatarUrl: null,
      color: "bg-stone-400",
      note: "",
    }
  }
  const name = host.displayName || host.username || "host"
  const avatarUrl = host.avatarUrl ?? null
  const initials = initialsFromName(name)
  return {
    id: host._id,
    name,
    username: host.username,
    avatar: initials,
    avatarUrl,
    color: "bg-stone-400",
    note: "",
  }
}

function initialsFromName(name: string): string {
  if (!name) return ""
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}

function hostIdentityFromApi(
  host: ApiEvent["hostId"]
): Pick<HostedEvent, "hostId" | "hostName" | "hostUsername" | "hostAvatarUrl"> {
  if (typeof host === "string") return { hostId: host }
  return {
    hostId: host._id,
    hostName: host.displayName || host.username || "host",
    hostUsername: host.username,
    hostAvatarUrl: host.avatarUrl ?? null,
  }
}

/**
 * Converts a backend event document into the EventItem shape consumed by the
 * home map/calendar UI.
 */
export function adaptApiEvent(api: ApiEvent): EventItem {
  const hostId = typeof api.hostId === "string" ? api.hostId : api.hostId?._id
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
      name: displayLocationName(api.locationName),
      address: api.locationAddress ?? undefined,
      coordinates: api.location?.coordinates,
    },
    attendees: (api.attendees ?? []).map((a) => {
      const name = a.displayName || a.username || "guest"
      return {
        id: a._id,
        name,
        username: a.username,
        avatar: name.charAt(0).toUpperCase(),
        color: "bg-stone-300",
        // The api only sends these fields at all when the caller is this
        // event's host; normalized to null here for any other viewer.
        willArriveAt: a.willArriveAt ?? null,
        arrivalStatus: a.arrivalStatus ?? null,
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
    ...hostIdentityFromApi(api.hostId),
    title: api.title,
    description: api.description ?? undefined,
    type: api.type,
    coverImageUrl: api.coverImageUrl ?? undefined,
    startAt: api.startAt,
    endAt: api.endAt,
    locationLabel: displayLocationName(api.locationName),
    locationDetail: api.locationAddress ?? undefined,
    coordinates: coordinatesFromApi(api.location),
    audienceLabel: api.visibility,
    attendeeCount: api.memberCount ?? api.attendees?.length ?? 0,
    attendingCount: api.goingCount ?? 0,
    attendees: (api.attendees ?? []).map((a) => ({
      id: a._id,
      displayName: a.displayName || a.username || "guest",
      username: a.username,
      avatarUrl: a.avatarUrl ?? null,
      // The api only sends these fields at all when the caller is this
      // event's host; normalized to null here for any other viewer.
      willArriveAt: a.willArriveAt ?? null,
      arrivalStatus: a.arrivalStatus ?? null,
    })),
    visibility: api.visibility,
    guestLimit: api.guestInviteLimit,
    allowGuestInvites: api.allowGuestInvites,
    myRsvp: api.myRsvp ?? null,
    updateCount: api.updateCount ?? 0,
    myWillArriveAt: api.myWillArriveAt ?? null,
    myArrivalStatus: api.myArrivalStatus ?? null,
    recurrence: "none",
    apiStatus: api.status,
    createdAt: api.createdAt ?? api.startAt,
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
 * The start delays a "right now" flare can be lit with (#312), in minutes
 * after creation. The composer's "starts" chips offer exactly these.
 */
export const NOW_START_OFFSETS_MIN = [0, 15, 30, 60] as const

/**
 * The lengths a flare's "how long?" chips offer, in minutes. "Pick a time"
 * and a scheduled flare's edit page offer exactly these; the "right now"
 * flow adds "open" (`OPEN_ENDED`) after them (#340). An open end for a
 * scheduled flare is #225.
 */
export const DURATIONS_MIN = [30, 60, 120, 180, 240] as const

/** The "open" chip's value: a "right now" flare without a set end. */
export const OPEN_ENDED = -1

/**
 * The length an "open" flare is saved with, since the api needs an end. A
 * stored flare this long reads back as "open" on the edit page (#340).
 */
export const OPEN_ENDED_FALLBACK_MIN = 8 * 60

/** The minutes a "how long?" chip stands for, "open" included. */
export function durationChipMinutes(chip: number): number {
  return chip === OPEN_ENDED ? OPEN_ENDED_FALLBACK_MIN : chip
}

/**
 * The "how long?" chip a stored length selects on the edit page (#340), or
 * null when no chip matches. Only a "right now" flare offers "open".
 */
export function durationChipFor(
  durationMinutes: number,
  mode: "now" | "scheduled"
): number | null {
  if (mode === "now" && durationMinutes === OPEN_ENDED_FALLBACK_MIN) {
    return OPEN_ENDED
  }
  return (DURATIONS_MIN as readonly number[]).includes(durationMinutes)
    ? durationMinutes
    : null
}

// How far a stored start may sit from `createdAt + offset` and still read as
// that "right now" offset: the client stamps `createdAt` for the start, the
// server stamps its own on save.
const NOW_OFFSET_TOLERANCE_MIN = 2

/**
 * Infers the edit form's shape from a hosted event's ISO range. A start at
 * creation, or 15, 30 or 60 minutes after it (±2 min), reads as a "right now"
 * flare with that offset (#330); anything else is scheduled. A planned flare
 * that happens to start exactly that long after it was made reads as
 * "right now" too, which is accepted: nothing stores how a flare was made.
 */
export function inferEventStartShape(
  event: Pick<HostedEvent, "startAt" | "endAt" | "createdAt">
): {
  mode: "now" | "scheduled"
  startOffsetMinutes?: number
  startDate?: string
  startTime?: string
  durationMinutes: number
} {
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / MIN)
  const created = new Date(event.createdAt).getTime()
  const startMs = start.getTime()
  const createdStartDiffMin = (startMs - created) / MIN

  const startOffsetMinutes = NOW_START_OFFSETS_MIN.find(
    (offset) =>
      Math.abs(createdStartDiffMin - offset) <= NOW_OFFSET_TOLERANCE_MIN
  )
  if (startOffsetMinutes !== undefined) {
    return { mode: "now", startOffsetMinutes, durationMinutes }
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
 * The start an edit should save. The edit form only shows the start to the
 * minute, so an untouched date and time keep the stored start exactly.
 * Rebuilding it from the inputs would drop its seconds, move it and mark the
 * form changed.
 *
 * A "right now" flare (#330) edits through its start chips instead: an
 * untouched offset keeps the stored start, and a new one starts it that many
 * minutes after creation, as lighting it did.
 */
export function editedStartAt(
  original: Pick<HostedEvent, "startAt" | "endAt" | "createdAt">,
  startDate: string,
  startTime: string,
  startOffsetMinutes?: number
): string {
  const shape = inferEventStartShape(original)
  if (shape.mode === "now") {
    if (
      startOffsetMinutes === undefined ||
      startOffsetMinutes === shape.startOffsetMinutes
    ) {
      return original.startAt
    }
    return new Date(
      new Date(original.createdAt).getTime() + startOffsetMinutes * MIN
    ).toISOString()
  }
  if (!startDate || !startTime) {
    return original.startAt
  }
  if (startDate === shape.startDate && startTime === shape.startTime) {
    return original.startAt
  }
  return new Date(`${startDate}T${startTime}`).toISOString()
}

/**
 * The end an edit should save (#340). With the "how long?" chips untouched
 * (no chip, or the one the flare opened with) the flare keeps its stored
 * length to the millisecond, so an untouched form saves `endAt` unchanged and
 * a moved start carries the same length along. A newly picked chip ends the
 * flare that long after its start; "open" gives the end the composer gives
 * an open-ended flare.
 */
export function editedEndAt(
  original: Pick<HostedEvent, "startAt" | "endAt" | "createdAt">,
  nextStartAt: string,
  durationChip: number | null
): string {
  const shape = inferEventStartShape(original)
  const startMs = new Date(nextStartAt).getTime()
  if (
    durationChip === null ||
    durationChip === durationChipFor(shape.durationMinutes, shape.mode)
  ) {
    if (nextStartAt === original.startAt) return original.endAt
    const lengthMs =
      new Date(original.endAt).getTime() - new Date(original.startAt).getTime()
    return new Date(startMs + lengthMs).toISOString()
  }
  return new Date(
    startMs + durationChipMinutes(durationChip) * MIN
  ).toISOString()
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
  const location = draft.location
  if (!location) {
    throw new Error("Event location must be resolved before creating an event.")
  }

  const name = location.name.trim()
  if (!name) {
    throw new Error(
      "Event location name must be resolved before creating an event."
    )
  }

  const [lng, lat] = location.coordinates
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    throw new Error(
      "Event location coordinates must be valid [lng, lat] values."
    )
  }

  return {
    locationName: name,
    locationAddress: location.address ?? null,
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
