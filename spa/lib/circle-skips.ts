"use client"

// New friends whose circle prompt was skipped (#597). Device-only, like the
// ideas switch (`idea-preferences.ts`): one localStorage key, never sent to
// the backend, so it follows the browser. A skipped prompt on a
// `connection_accepted` row or the contact-link screen then stays gone after
// a reload. Every storage call is wrapped, because localStorage can be
// missing or throw (private windows, blocked site data). When it does, the
// skip still holds for the rest of the session from `memory`.
//
// Keyed by the friend's user id (not the row), so the same person is skipped
// on every surface at once.

export const CIRCLE_SKIPS_KEY = "sponti.circle-skips.v1"
// Oldest skips drop first, so the list can't grow without bound.
const MAX_SKIPS = 200

// Set by a write in this session; null means "read storage on next use".
let memory: string[] | null = null

function read(): string[] {
  if (memory) return memory
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(CIRCLE_SKIPS_KEY) ?? "[]"
    )
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === "string")
  } catch {
    return []
  }
}

export function isCircleSkipped(userId: string): boolean {
  return read().includes(userId)
}

export function rememberCircleSkip(userId: string): void {
  const current = read()
  if (current.includes(userId)) return
  memory = [...current, userId].slice(-MAX_SKIPS)
  try {
    window.localStorage.setItem(CIRCLE_SKIPS_KEY, JSON.stringify(memory))
  } catch {
    // Not stored: the skip lasts until the page is reloaded.
  }
}

/** Test seam: forget the in-memory list so the next read hits storage. */
export function resetCircleSkipsForTest(): void {
  memory = null
}
