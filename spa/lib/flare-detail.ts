// Pure rules behind the flare detail layout (#139, layout D from #162). Shared
// by the full page (/event/[id]) and the map's detail sheet, so both answer
// "who is looking, when is it, what can they do" the same way.

import type {
  ArrivalStatus,
  EventCoordinates,
  EventGuestInviteMode,
  EventRsvp,
  EventVisibility,
} from "@/lib/api/events"

const MIN = 60_000
const HOUR = 60 * MIN

/** The viewer's relationship to a flare, which picks the main action. */
export type FlareViewer = "host" | "joined" | "invited"

export function flareViewer({
  isHost,
  myRsvp,
}: {
  isHost: boolean
  myRsvp?: EventRsvp | null
}): FlareViewer {
  if (isHost) return "host"
  return myRsvp === "going" ? "joined" : "invited"
}

export type FlareTiming = "live" | "soon" | "later" | "ended" | "cancelled"

/** "soon" is the ETA window: starts within the next hour. */
export const ETA_WINDOW_MS = HOUR

export function flareTiming(
  {
    startAt,
    endAt,
    cancelled = false,
  }: { startAt: string; endAt: string; cancelled?: boolean },
  now: number = Date.now()
): FlareTiming {
  if (cancelled) return "cancelled"
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (now > end) return "ended"
  if (now >= start) return "live"
  return start - now <= ETA_WINDOW_MS ? "soon" : "later"
}

/**
 * Which arrival control applies for this timing (#211): minute chips while
 * live, on-time/running-late while starting within the hour but not yet
 * live, no control further out.
 */
export type EtaControlKind = "minutes" | "status" | null

export function etaControlKind(timing: FlareTiming): EtaControlKind {
  if (timing === "live") return "minutes"
  if (timing === "soon") return "status"
  return null
}

/** An arrival answer is only asked for while the flare is live or starting within 1h. */
export function etaAvailable(timing: FlareTiming): boolean {
  return etaControlKind(timing) !== null
}

/** The drawn walking route is capped to walking distance (straight line). */
export const ROUTE_MAX_METERS = 2_000

/**
 * Whether the map should draw a walking route to the flare. Never for the
 * host, and only when the viewer's location is known and within 2 km. "open in
 * maps" is offered regardless.
 */
export function shouldDrawRoute({
  viewer,
  distanceMeters,
}: {
  viewer: FlareViewer
  distanceMeters: number | null
}): boolean {
  if (viewer === "host" || distanceMeters === null) return false
  return distanceMeters <= ROUTE_MAX_METERS
}

/** Google Maps at the flare's pin, or a search for the place name without one. */
export function googleMapsUrl({
  coordinates,
  name,
}: {
  coordinates?: EventCoordinates | null
  name: string
}): string {
  const query = coordinates ? `${coordinates.lat},${coordinates.lng}` : name
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** "1h 35m", "40 min", "2 days" — for countdowns in the header line. */
export function formatSpan(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MIN))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours >= 48) return `${Math.round(hours / 24)} days`
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** The line under the title: "live · ends in 1h 35m", "starts in 40 min". */
export function flareStatusLine(
  { startAt, endAt }: { startAt: string; endAt: string },
  timing: FlareTiming,
  now: number = Date.now()
): string {
  if (timing === "cancelled") return "cancelled"
  if (timing === "ended") return "ended"
  if (timing === "live") {
    return `live · ends in ${formatSpan(new Date(endAt).getTime() - now)}`
  }
  return `starts in ${formatSpan(new Date(startAt).getTime() - now)}`
}

/**
 * "about 3 spots left · 8 max". Only public flares have a guest limit (#181);
 * a private flare is capped by who the host invited, so this returns null.
 * The limit is exact only while there's no +1/re-share; otherwise "about".
 */
export function spotsLeftLabel({
  visibility,
  guestLimit,
  headcount,
  allowGuestInvites,
}: {
  visibility: EventVisibility
  guestLimit: number
  /** Everyone going, +1s included once they exist (#159). */
  headcount: number
  allowGuestInvites?: EventGuestInviteMode
}): string | null {
  if (visibility !== "public" || guestLimit <= 0) return null
  const left = Math.max(0, guestLimit - headcount)
  if (left === 0) return `full · ${guestLimit} max`
  const approximate =
    allowGuestInvites !== undefined && allowGuestInvites !== "none"
  const spots = `${left} ${left === 1 ? "spot" : "spots"} left`
  return `${approximate ? "about " : ""}${spots} · ${guestLimit} max`
}

/** "you're arriving in 15 min" for the viewer's own plan row. */
export function ownArrivalLabel(
  willArriveAt: string,
  now: number = Date.now()
): string {
  const diffMin = Math.round((new Date(willArriveAt).getTime() - now) / MIN)
  if (diffMin <= 0) return "you should be there"
  if (diffMin < 60) return `you're arriving in ${diffMin} min`
  const hours = Math.round(diffMin / 60)
  return `you're arriving in about ${hours} ${hours === 1 ? "hr" : "hrs"}`
}

/** ETA choices, as labels `etaToIso` understands. */
export const ETA_CHOICES = ["5 min", "15 min", "30 min", "1 hr"] as const

/**
 * The near-term arrival choices (#211), offered instead of ETA_CHOICES while
 * a flare hasn't started but starts within the hour.
 */
export const ARRIVAL_STATUS_CHOICES: ReadonlyArray<{
  value: ArrivalStatus
  label: string
}> = [
  { value: "on_time", label: "on time" },
  { value: "running_late", label: "running late" },
]

/** "you'll be on time" / "you're running late" for the viewer's own plan row. */
export function ownArrivalStatusLabel(status: ArrivalStatus): string {
  return status === "on_time" ? "you'll be on time" : "you're running late"
}

/**
 * The viewer's own plan summary, given whichever of the two mutually
 * exclusive arrival fields is set (an api invariant — #211). Null when
 * neither is set, so callers can supply their own "no answer" copy.
 */
export function ownArrivalSummary(
  {
    willArriveAt,
    arrivalStatus,
  }: { willArriveAt?: string | null; arrivalStatus?: ArrivalStatus | null },
  now: number = Date.now()
): string | null {
  if (arrivalStatus) return ownArrivalStatusLabel(arrivalStatus)
  if (willArriveAt) return ownArrivalLabel(willArriveAt, now)
  return null
}
