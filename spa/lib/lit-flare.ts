// A flare the person has just lit (#376): the composer announces it once the
// api has confirmed it, and the home map, if it is on screen, shows it at once
// (without waiting for its next refetch) and moves to it. Nothing is kept: a
// map that isn't mounted has nothing to move.

import type { EventItem } from "@/lib/api/events"

type Listener = (event: EventItem) => void

const listeners = new Set<Listener>()

export function announceLitFlare(event: EventItem): void {
  for (const listener of listeners) listener(event)
}

export function subscribeToLitFlare(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** How long the map keeps showing a lit flare the api's list hasn't returned. */
export const LIT_FLARE_HOLD_MS = 5 * 60_000

export type LitFlare = { event: EventItem; litAt: number }

/**
 * The api's flares plus the ones just lit that it hasn't returned yet (and for
 * a few minutes only: after that the api's list is the truth, so a flare that
 * was cancelled elsewhere doesn't linger).
 */
export function withLitFlares(
  fetched: readonly EventItem[],
  lit: readonly LitFlare[],
  now: number
): readonly EventItem[] {
  const pending = lit.filter(
    (l) =>
      now - l.litAt < LIT_FLARE_HOLD_MS &&
      !fetched.some((e) => e.id === l.event.id)
  )
  return pending.length === 0
    ? fetched
    : [...fetched, ...pending.map((l) => l.event)]
}
