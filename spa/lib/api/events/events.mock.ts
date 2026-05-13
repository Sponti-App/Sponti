import { useSyncExternalStore } from "react"
import { MOCK_CONNECTIONS } from "@/lib/circles"
import { getCirclesSnapshot } from "@/lib/circles-store"
import type {
  DraftEvent,
  EventCoordinates,
  EventItem,
  EventStatus,
  HostedEvent,
} from "./events.types"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const now = Date.now()

// Temporary demo events used when the backend is disabled or unavailable.
export const MOCK_EVENTS: EventItem[] = [
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
      note: "grabbing a latte before my 4pm",
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
      note: "we're on chapter 4 - show up even if you didn't read",
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

// Demo-mode events used when map event API calls fail.
export const DEMO_MAP_EVENTS = MOCK_EVENTS.filter(
  (event) => !!event.location.coordinates
)

// Small lat/lng deltas applied to mock events so they cluster near the user's
// real coordinates rather than appearing in SF for every tester.
const MOCK_OFFSETS: Array<{ dLat: number; dLng: number }> = [
  { dLat: 0.0025, dLng: 0.0015 },
  { dLat: -0.003, dLng: -0.0018 },
  { dLat: 0.001, dLng: -0.004 },
  { dLat: -0.0015, dLng: 0.0035 },
  { dLat: 0.004, dLng: -0.002 },
]

export function repositionMockEvents(
  events: EventItem[],
  userCoords: EventCoordinates | null
): EventItem[] {
  if (!userCoords) return events
  return events.map((event, index) => {
    if (!event.location.coordinates) return event
    const offset = MOCK_OFFSETS[index % MOCK_OFFSETS.length]
    return {
      ...event,
      location: {
        ...event.location,
        coordinates: [
          userCoords.lng + offset.dLng,
          userCoords.lat + offset.dLat,
        ],
      },
    }
  })
}

// Temporary hosted-event store for the host-side flows. It mirrors the events
// + event_members collections until /event is wired to backend event APIs.
const STORAGE_KEY = "sponti.hostedEvents.v1"
const CHANGE_EVENT = "sponti:hosted-events-change"

function mockHostedEvents(): HostedEvent[] {
  const hostedNow = Date.now()
  return [
    {
      id: "live-1",
      title: "patio hang",
      startAt: new Date(hostedNow - 25 * MIN).toISOString(),
      endAt: new Date(hostedNow + 95 * MIN).toISOString(),
      locationLabel: "courtyard",
      locationDetail: "23 Allenby St",
      audienceLabel: "close friends",
      attendeeIds: ["maya", "sam", "riley", "lina"],
      attendingIds: ["maya", "sam"],
      visibility: "private",
      recurrence: "none",
      updatedAt: new Date(hostedNow - 25 * MIN).toISOString(),
    },
    {
      id: "up-1",
      title: "rooftop drinks",
      startAt: new Date(hostedNow + 4 * HOUR).toISOString(),
      endAt: new Date(hostedNow + 7 * HOUR).toISOString(),
      locationLabel: "the annex",
      locationDetail: "rooftop bar",
      audienceLabel: "studio crew",
      attendeeIds: ["maya", "jordan", "lina"],
      attendingIds: ["maya", "jordan"],
      visibility: "private",
      recurrence: "none",
      updatedAt: new Date(hostedNow - 2 * HOUR).toISOString(),
    },
    {
      id: "up-2",
      title: "morning run",
      startAt: new Date(hostedNow + DAY + 8 * HOUR).toISOString(),
      endAt: new Date(hostedNow + DAY + 9 * HOUR).toISOString(),
      locationLabel: "north park",
      audienceLabel: "all friends",
      attendeeIds: MOCK_CONNECTIONS.map((connection) => connection.id),
      attendingIds: ["sam"],
      visibility: "public",
      recurrence: "weekly",
      updatedAt: new Date(hostedNow - 4 * HOUR).toISOString(),
    },
    {
      id: "past-1",
      title: "studio session",
      startAt: new Date(hostedNow - 7 * DAY).toISOString(),
      endAt: new Date(hostedNow - 7 * DAY + 3 * HOUR).toISOString(),
      locationLabel: "downtown loft",
      audienceLabel: "studio crew",
      attendeeIds: ["jordan", "lina"],
      attendingIds: ["jordan", "lina"],
      visibility: "private",
      recurrence: "none",
      updatedAt: new Date(hostedNow - 7 * DAY).toISOString(),
    },
  ]
}

let cached: HostedEvent[] | null = null

function readFromStorage(): HostedEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seed = mockHostedEvents()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as HostedEvent[]
  } catch {
    return mockHostedEvents()
  }
}

function snapshot(): HostedEvent[] {
  if (cached === null) cached = readFromStorage()
  return cached
}

function writeAll(events: HostedEvent[]): void {
  if (typeof window === "undefined") return
  cached = events
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

const EMPTY: HostedEvent[] = []

export function useHostedEvents(): HostedEvent[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}

export function getHostedEvent(id: string): HostedEvent | undefined {
  return snapshot().find((event) => event.id === id)
}

export function deriveStatus(
  event: HostedEvent,
  currentTime: number = Date.now()
): EventStatus {
  if (event.cancelledAt) return "cancelled"
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  if (currentTime >= start && currentTime <= end) return "live"
  if (currentTime < start) return "upcoming"
  return "past"
}

export function updateHostedEvent(
  id: string,
  patch: Partial<HostedEvent>
): void {
  writeAll(
    snapshot().map((event) =>
      event.id === id
        ? { ...event, ...patch, updatedAt: new Date().toISOString() }
        : event
    )
  )
}

export function cancelHostedEvent(id: string): void {
  updateHostedEvent(id, { cancelledAt: new Date().toISOString() })
}

export function uncancelHostedEvent(id: string): void {
  updateHostedEvent(id, { cancelledAt: undefined })
}

export function shiftStart(id: string, deltaMs: number): void {
  const event = getHostedEvent(id)
  if (!event) return
  const start = new Date(event.startAt).getTime() + deltaMs
  const end = new Date(event.endAt).getTime() + deltaMs
  updateHostedEvent(id, {
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
  })
}

export function setLocation(
  id: string,
  locationLabel: string,
  locationDetail?: string
): void {
  updateHostedEvent(id, { locationLabel, locationDetail })
}

export function duplicateHostedEvent(id: string): HostedEvent | null {
  const original = getHostedEvent(id)
  if (!original) return null
  const duplicateNow = Date.now()
  const span =
    new Date(original.endAt).getTime() - new Date(original.startAt).getTime()
  const next: HostedEvent = {
    ...original,
    id: `evt-${duplicateNow}`,
    startAt: new Date(duplicateNow).toISOString(),
    endAt: new Date(duplicateNow + span).toISOString(),
    cancelledAt: undefined,
    attendingIds: [],
    updatedAt: new Date().toISOString(),
  }
  writeAll([...snapshot(), next])
  return next
}

const WHERE_LABEL: Record<DraftEvent["whereType"], string> = {
  current: "current location",
  search: "custom",
  saved: "saved place",
}

function audienceForDraft(draft: DraftEvent): { label: string; ids: string[] } {
  if (draft.audience !== "custom") {
    const circle = getCirclesSnapshot().find((c) => c.id === draft.audience)
    if (circle) return { label: circle.name, ids: circle.memberIds }
  }
  const ids = draft.selectedFriendIds ?? []
  if (draft.customListName?.trim())
    return { label: draft.customListName.trim(), ids }
  return { label: `${ids.length} friend${ids.length === 1 ? "" : "s"}`, ids }
}

function startEndFromDraft(draft: DraftEvent): {
  startAt: string
  endAt: string
} {
  let startMs: number
  if (draft.mode === "now") {
    const offset = (draft.startOffsetMinutes ?? 0) * MIN
    startMs = new Date(draft.createdAt).getTime() + offset
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
 * Temporary compatibility bridge after POST /events succeeds. It mirrors the
 * submitted draft into the local hosted-event store until /event reads backend
 * events directly.
 */
export function pushDraftAsHosted(draft: DraftEvent): HostedEvent {
  const { label, ids } = audienceForDraft(draft)
  const { startAt, endAt } = startEndFromDraft(draft)
  const hostedNow = Date.now()
  const locationLabel =
    draft.whereType === "search" && draft.customWhere
      ? draft.customWhere
      : draft.whereType === "saved" && draft.savedPlaceLabel
        ? draft.savedPlaceLabel
        : WHERE_LABEL[draft.whereType]
  const event: HostedEvent = {
    id: `evt-${hostedNow}`,
    title: draft.title.trim() || draft.eventType,
    description: draft.details?.trim() || undefined,
    startAt,
    endAt,
    locationLabel,
    audienceLabel: label,
    attendeeIds: ids,
    attendingIds: [],
    visibility: draft.visibility,
    recurrence: draft.recurrence ?? "none",
    updatedAt: new Date().toISOString(),
  }
  writeAll([...snapshot(), event])
  return event
}

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
