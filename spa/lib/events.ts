// Frontend event shape. Kept close to the backend `Event` model so the API
// adapter in lib/api/events.ts is a thin mapping rather than a translation.

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export type EventVisibility = "public" | "private"
export type EventType = "coffee" | "hang" | "run"

export interface EventItem {
  id: string
  title: string
  type: EventType
  startAt: string
  endAt: string
  visibility: EventVisibility
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
    // [lng, lat] — GeoJSON order, matches backend `location.coordinates`.
    coordinates?: [number, number]
  }
  attendees: Array<{ name: string; avatar: string; color: string }>
  going: number
}

// ---- presence / time helpers ----

export function isImminent(event: EventItem, now: number = Date.now()): boolean {
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  // Imminent = live now OR starting within the next 30 minutes
  return now >= start - 30 * MIN && now <= end
}

export function isLive(event: EventItem, now: number = Date.now()): boolean {
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  return now >= start && now <= end
}

export function eventDayKey(event: EventItem): string {
  // Returns YYYY-MM-DD in local time
  const d = new Date(event.startAt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function formatEventTime(event: EventItem): string {
  return new Date(event.startAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatRelativeStatus(event: EventItem, now: number = Date.now()): string {
  const start = new Date(event.startAt).getTime()
  if (isLive(event, now)) return "happening now"
  const diffMs = start - now
  if (diffMs < 0) return "ended"
  const diffMin = Math.round(diffMs / MIN)
  if (diffMin < 60) return `in ${diffMin} min`
  const sameDay = dayKey(new Date(start)) === dayKey(new Date(now))
  if (sameDay) return formatEventTime(event)
  const tomorrowKey = dayKey(new Date(now + DAY))
  if (dayKey(new Date(start)) === tomorrowKey) return `${formatEventTime(event)} tomorrow`
  // Otherwise: weekday + time, e.g. "Sat 10am"
  return new Date(start).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

// ---- color helpers ----

export function avatarText(bgColor: string): string {
  return bgColor === "bg-accent" || bgColor === "bg-stone-800"
    ? "text-accent-foreground"
    : "text-foreground"
}

// ---- distance/walk helpers (Haversine; ~ok for sub-50km) ----

const EARTH_RADIUS_M = 6_371_000

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
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
  user: { lat: number; lng: number } | null,
): { meters: number; label: string } | null {
  if (!user || !event.location.coordinates) return null
  const [lng, lat] = event.location.coordinates
  const meters = haversineMeters(user, { lat, lng })
  return { meters, label: formatDistance(meters) }
}

export function formatDistance(meters: number): string {
  // Approximate units; backend can later canonicalize to user locale.
  const miles = meters / 1609.344
  if (miles < 0.1) return `${Math.round(meters)} m`
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

export function walkTimeLabel(meters: number): string {
  // ~80m/min ≈ 4.8 km/h walking pace
  const minutes = Math.max(1, Math.round(meters / 80))
  if (minutes < 60) return `${minutes} min walk`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours} hr walk` : `${hours}h ${rem}m walk`
}

export function eventCoords(event: EventItem): { lat: number; lng: number } | null {
  if (!event.location.coordinates) return null
  const [lng, lat] = event.location.coordinates
  return { lat, lng }
}

// ---- mock seed (replaced by API once NEXT_PUBLIC_API_BASE_URL is wired) ----

const now = Date.now()

export const events: EventItem[] = [
  {
    id: "evt-mira",
    title: "coffee at Reuben's",
    type: "coffee",
    startAt: new Date(now - 10 * MIN).toISOString(),
    endAt: new Date(now + 50 * MIN).toISOString(),
    visibility: "public",
    host: {
      name: "Mira",
      avatar: "M",
      color: "bg-accent",
      note: "grabbing a latte before my 4pm — pop by if you're around ☕",
    },
    location: {
      name: "Reuben's Espresso",
      area: "Fillmore",
      address: "2400 Fillmore St, San Francisco, CA",
      coordinates: [-122.4364, 37.7855],
    },
    attendees: [
      { name: "Mira", avatar: "M", color: "bg-accent" },
      { name: "Sam", avatar: "S", color: "bg-stone-300" },
    ],
    going: 2,
  },
  {
    id: "evt-sam-patio",
    title: "patio hang",
    type: "hang",
    startAt: new Date(now + 4 * HOUR).toISOString(),
    endAt: new Date(now + 7 * HOUR).toISOString(),
    visibility: "private",
    host: {
      name: "Sam",
      avatar: "S",
      color: "bg-stone-800",
      note: "patio hangs at my place, bring snacks!",
    },
    location: {
      name: "the patio",
      area: "Castro",
      coordinates: [-122.4324, 37.7825],
    },
    attendees: [
      { name: "Sam", avatar: "S", color: "bg-stone-800" },
      { name: "K", avatar: "K", color: "bg-stone-300" },
    ],
    going: 4,
  },
  {
    id: "evt-run-club",
    title: "run club",
    type: "run",
    startAt: new Date(now + DAY + 2 * HOUR).toISOString(),
    endAt: new Date(now + DAY + 3 * HOUR).toISOString(),
    visibility: "public",
    host: {
      name: "J",
      avatar: "J",
      color: "bg-stone-400",
      note: "meet at the main gate, bring water!",
    },
    location: {
      name: "Dolores Park",
      area: "Mission",
      coordinates: [-122.4271, 37.7596],
    },
    attendees: [{ name: "J", avatar: "J", color: "bg-stone-400" }],
    going: 6,
  },
  {
    id: "evt-bookclub",
    title: "book club",
    type: "hang",
    startAt: new Date(now + 3 * DAY + 6 * HOUR).toISOString(),
    endAt: new Date(now + 3 * DAY + 8 * HOUR).toISOString(),
    visibility: "private",
    host: {
      name: "Lina",
      avatar: "L",
      color: "bg-stone-500",
      note: "we're on chapter 4 — show up even if you didn't read 📚",
    },
    location: {
      name: "Lina's place",
      area: "Hayes Valley",
      coordinates: [-122.4267, 37.7766],
    },
    attendees: [
      { name: "Lina", avatar: "L", color: "bg-stone-500" },
      { name: "Mira", avatar: "M", color: "bg-accent" },
    ],
    going: 3,
  },
]
