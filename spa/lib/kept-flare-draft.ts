import { ANYWHERE_IDEAS } from "@/lib/flare-ideas.anywhere.data"
import { FLARE_IDEAS } from "@/lib/flare-ideas.data"
import type { Idea } from "@/lib/flare-ideas-anywhere"
import { REDIRECT_PARAM } from "@/lib/redirect-path"

// #389: the flare a signed-out visitor started (an idea spot, or a blank
// flare from the nav's flare button), kept across the sign-up or sign-in
// round trip so they land back in the composer with it.
//
// Only the idea's id is stored, never free text: on the way back it is looked
// up in the curated lists (the spots, and the place-less ideas of #515), so
// nothing read from storage reaches the composer
// unchecked. It lives in sessionStorage (this tab only), and every storage
// call is wrapped, because storage can be missing or throw (private windows,
// blocked site data). Then the draft is simply not kept.

export const KEPT_FLARE_DRAFT_KEY = "sponti.kept-flare-draft.v1"

/** The draft the visitor started: an idea, or a blank flare. */
export type KeptFlareDraft = { idea: Idea | null }

/** Marks the trip back from the auth pages as "with a kept draft". */
export const RESUME_PARAM = "resume"
export const RESUME_VALUE = "flare"

/** Where the auth pages send the visitor once they're signed in. */
export const RESUME_PATH = `/?${RESUME_PARAM}=${RESUME_VALUE}`

/** `?redirectTo=…` for the register and login links in the sign-up sheet. */
export const RESUME_REDIRECT_QUERY = `?${REDIRECT_PARAM}=${encodeURIComponent(RESUME_PATH)}`

type Stored = { ideaId: string | null }

export function keepFlareDraft(draft: KeptFlareDraft): void {
  const stored: Stored = { ideaId: draft.idea?.id ?? null }
  try {
    window.sessionStorage.setItem(KEPT_FLARE_DRAFT_KEY, JSON.stringify(stored))
  } catch {
    // Not kept: they land on the map after signing up, as before.
  }
}

/**
 * The kept draft, or null when there is none (or storage can't be read). An
 * idea that is no longer in the list comes back as a blank flare.
 */
export function readKeptFlareDraft(): KeptFlareDraft | null {
  try {
    const raw = window.sessionStorage.getItem(KEPT_FLARE_DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const { ideaId } = parsed as Partial<Stored>
    const idea =
      typeof ideaId === "string"
        ? (FLARE_IDEAS.find((i) => i.id === ideaId) ??
          ANYWHERE_IDEAS.find((i) => i.id === ideaId) ??
          null)
        : null
    return { idea }
  } catch {
    return null
  }
}

export function clearKeptFlareDraft(): void {
  try {
    window.sessionStorage.removeItem(KEPT_FLARE_DRAFT_KEY)
  } catch {
    // Nothing to clear if storage can't be reached.
  }
}

/** Whether a page's query string is the trip back with a kept draft. */
export function isResumeSearch(search: string): boolean {
  return new URLSearchParams(search).get(RESUME_PARAM) === RESUME_VALUE
}
