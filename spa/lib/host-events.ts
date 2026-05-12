// Hosted-event store for the host-side flows. Shape mirrors the events +
// event_members collections so the api fetch layer can drop in cleanly.
//
// Persistence is localStorage for the prototype, exposed via
// useSyncExternalStore so React 19's purity rules stay happy.

import { useSyncExternalStore } from "react"
import { MOCK_CONNECTIONS } from "./circles"
import { getCirclesSnapshot } from "./circles-store"
import type { DraftEvent, Recurrence } from "./draft-events"

export type EventStatus = "live" | "upcoming" | "past" | "cancelled"
export type EventVisibility = "private" | "public"

export type HostedEvent = {
  id: string
  title: string
  description?: string
  startAt: string
  endAt: string
  locationLabel: string
  locationDetail?: string
  audienceLabel: string
  // Resolved member ids — backed by event_members.userId on the server.
  attendeeIds: string[]
  // Subset who said yes (rsvpStatus === "yes").
  attendingIds: string[]
  visibility: EventVisibility
  recurrence: Recurrence
  cancelledAt?: string
  updatedAt: string
}

const STORAGE_KEY = "sponti.hostedEvents.v1"
const CHANGE_EVENT = "sponti:hosted-events-change"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function mockSeed(): HostedEvent[] {
  const now = Date.now()
  return [
    {
      id: "live-1",
      title: "patio hang",
      startAt: new Date(now - 25 * MIN).toISOString(),
      endAt: new Date(now + 95 * MIN).toISOString(),
      locationLabel: "courtyard",
      locationDetail: "23 Allenby St",
      audienceLabel: "close friends",
      attendeeIds: ["maya", "sam", "riley", "lina"],
      attendingIds: ["maya", "sam"],
      visibility: "private",
      recurrence: "none",
      updatedAt: new Date(now - 25 * MIN).toISOString(),
    },
    {
      id: "up-1",
      title: "rooftop drinks",
      startAt: new Date(now + 4 * HOUR).toISOString(),
      endAt: new Date(now + 7 * HOUR).toISOString(),
      locationLabel: "the annex",
      locationDetail: "rooftop bar",
      audienceLabel: "studio crew",
      attendeeIds: ["maya", "jordan", "lina"],
      attendingIds: ["maya", "jordan"],
      visibility: "private",
      recurrence: "none",
      updatedAt: new Date(now - 2 * HOUR).toISOString(),
    },
    {
      id: "up-2",
      title: "morning run",
      startAt: new Date(now + DAY + 8 * HOUR).toISOString(),
      endAt: new Date(now + DAY + 9 * HOUR).toISOString(),
      locationLabel: "north park",
      audienceLabel: "all friends",
      attendeeIds: MOCK_CONNECTIONS.map((c) => c.id),
      attendingIds: ["sam"],
      visibility: "public",
      recurrence: "weekly",
      updatedAt: new Date(now - 4 * HOUR).toISOString(),
    },
    {
      id: "past-1",
      title: "studio session",
      startAt: new Date(now - 7 * DAY).toISOString(),
      endAt: new Date(now - 7 * DAY + 3 * HOUR).toISOString(),
      locationLabel: "downtown loft",
      audienceLabel: "studio crew",
      attendeeIds: ["jordan", "lina"],
      attendingIds: ["jordan", "lina"],
      visibility: "private",
      recurrence: "none",
      updatedAt: new Date(now - 7 * DAY).toISOString(),
    },
  ]
}

let cached: HostedEvent[] | null = null

function readFromStorage(): HostedEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seed = mockSeed()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as HostedEvent[]
  } catch {
    return mockSeed()
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
  return snapshot().find((e) => e.id === id)
}

export function deriveStatus(event: HostedEvent, now: number = Date.now()): EventStatus {
  if (event.cancelledAt) return "cancelled"
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  if (now >= start && now <= end) return "live"
  if (now < start) return "upcoming"
  return "past"
}

export function updateHostedEvent(id: string, patch: Partial<HostedEvent>): void {
  writeAll(
    snapshot().map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
    ),
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
  locationDetail?: string,
): void {
  updateHostedEvent(id, { locationLabel, locationDetail })
}

export function duplicateHostedEvent(id: string): HostedEvent | null {
  const original = getHostedEvent(id)
  if (!original) return null
  const now = Date.now()
  const span = new Date(original.endAt).getTime() - new Date(original.startAt).getTime()
  const next: HostedEvent = {
    ...original,
    id: `evt-${now}`,
    startAt: new Date(now).toISOString(),
    endAt: new Date(now + span).toISOString(),
    cancelledAt: undefined,
    attendingIds: [],
    updatedAt: new Date().toISOString(),
  }
  writeAll([...snapshot(), next])
  return next
}

// ---- conversion from create-form draft to hosted event ----

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
  if (draft.customListName?.trim()) return { label: draft.customListName.trim(), ids }
  return { label: `${ids.length} friend${ids.length === 1 ? "" : "s"}`, ids }
}

function startEndFromDraft(draft: DraftEvent): { startAt: string; endAt: string } {
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
  return { startAt: new Date(startMs).toISOString(), endAt: new Date(endMs).toISOString() }
}

export function pushDraftAsHosted(draft: DraftEvent): HostedEvent {
  const { label, ids } = audienceForDraft(draft)
  const { startAt, endAt } = startEndFromDraft(draft)
  const now = Date.now()
  const locationLabel =
    draft.whereType === "search" && draft.customWhere
      ? draft.customWhere
      : draft.whereType === "saved" && draft.savedPlaceLabel
        ? draft.savedPlaceLabel
        : WHERE_LABEL[draft.whereType]
  const event: HostedEvent = {
    id: `evt-${now}`,
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
  const now = Date.now()
  const diffMin = Math.round((start.getTime() - now) / MIN)
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
