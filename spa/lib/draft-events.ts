// Mocked submission store for the event-creation flow.
// Persists drafts to localStorage so the form has somewhere to write to
// while the api/ POST endpoint isn't wired up yet.

const STORAGE_KEY = "sponti.draftEvents.v1"

export type DraftEvent = {
  mode: "now" | "scheduled"
  what: string
  durationMinutes: number
  startDate?: string
  startTime?: string
  whereType: "current" | "home" | "coffee" | "search" | "custom"
  customWhere?: string
  title?: string
  guestLimit: number | null
  audience: "close-friends" | "all-friends" | "custom-list"
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
  // Visible breadcrumb during dev — replace with toast once we have one.
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
