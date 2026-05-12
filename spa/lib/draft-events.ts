// Mocked submission store for the event-creation flow.
// Persists drafts to localStorage so the form has somewhere to write to
// while the api/ POST endpoint isn't wired up yet.

const STORAGE_KEY = "sponti.draftEvents.v2"

export type Recurrence = "none" | "daily" | "weekly"
// A circle id (e.g. "inner", "close", "all", or a custom-NNN id) OR the
// literal "custom" for the ad-hoc friend-picker path.
export type Audience = string
export type EventType = "food" | "drinks" | "sports" | "hangout"

export type DraftEvent = {
  mode: "now" | "scheduled"
  eventType: EventType
  title: string
  details?: string
  durationMinutes: number
  startOffsetMinutes?: number
  startDate?: string
  startTime?: string
  recurrence?: Recurrence
  whereType: "current" | "search" | "saved"
  customWhere?: string
  savedPlaceLabel?: string
  guestLimit: number | null
  audience: Audience
  selectedFriendIds?: string[]
  customListName?: string
  visibility: "private" | "public"
  allowForward: boolean
  allowPlusOne: boolean
  createdAt: string
}

export function saveDraftEvent(draft: DraftEvent): void {
  if (typeof window === "undefined") return
  const existing = getDraftEvents()
  const next = [...existing, draft]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  console.info("[Sponti] draft event saved", draft)
}

export function getDraftEvents(): DraftEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DraftEvent[]) : []
  } catch {
    return []
  }
}
