// A flare the person has just lit (#376): the composer announces it once the
// api has confirmed it, and the home map, if it is on screen, shows it at once
// (without waiting for its next refetch) and moves to it. Nothing is kept: a
// map that isn't mounted has nothing to move.
//
// With the lighting takeover, the map also moves at the strike (the flare's
// spot is known before the api answers), and the new flare's pin is "held":
// the map draws it hidden, so the takeover's own pin is the only one on
// screen, until the takeover hands over to it and releases it.

import type { EventItem } from "@/lib/api/events"
import type { GeoCoords } from "@/lib/geolocation"

export type LitOptions = {
  /** The map draws the pin hidden until releaseLitPin(id). */
  held?: boolean
}

type Listener = (event: EventItem, options: LitOptions) => void

const listeners = new Set<Listener>()

export function announceLitFlare(
  event: EventItem,
  options: LitOptions = {}
): void {
  for (const listener of listeners) listener(event, options)
}

export function subscribeToLitFlare(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

type FocusListener = (coords: GeoCoords) => void
const focusListeners = new Set<FocusListener>()

/** A flare is being lit at `coords`: the map moves there now. */
export function announceLitFocus(coords: GeoCoords): void {
  for (const listener of focusListeners) listener(coords)
}

export function subscribeToLitFocus(listener: FocusListener): () => void {
  focusListeners.add(listener)
  return () => {
    focusListeners.delete(listener)
  }
}

type ReleaseListener = (id: string) => void
const releaseListeners = new Set<ReleaseListener>()

/** The takeover has handed over: the map's pin for `id` shows from now on. */
export function releaseLitPin(id: string): void {
  for (const listener of releaseListeners) listener(id)
}

export function subscribeToLitPinRelease(
  listener: ReleaseListener
): () => void {
  releaseListeners.add(listener)
  return () => {
    releaseListeners.delete(listener)
  }
}

/** A held pin shows anyway after this long, whatever became of the takeover. */
export const LIT_PIN_HOLD_MAX_MS = 15_000

/** How long the map keeps showing a lit flare the api's list hasn't returned. */
export const LIT_FLARE_HOLD_MS = 5 * 60_000

export type LitFlare = {
  event: EventItem
  litAt: number
  /** Drawn hidden until the takeover releases it. */
  held?: boolean
}

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
