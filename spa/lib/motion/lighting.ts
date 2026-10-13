// The lighting moment's rules (#375, #376), kept apart from the DOM so they
// can be unit-tested. The direction is recorded in
// docs/decisions/flare-lighting-motion.md: a strike to light, then the
// full-screen "night flare" takeover for every flare (lib/motion/takeover.ts),
// the full burst for someone's first flare and the soft one after, peach for
// what is alight, and cross-fades only under reduced motion.

import type { EventVisibility } from "@/lib/api/events"

/** The lit flare's body takes its map pin's colour (#315). */
export type FlareTone = "invite" | "open"

export type Point = { x: number; y: number }

// ---- which burst ------------------------------------------------------------

const LIT_ON_DEVICE_KEY = "sponti.flare-lit.v1"

/** How big the burst is: "full" for someone's first flare, "soft" after. */
export type BurstLevel = "full" | "soft"

/**
 * The full burst plays only when we know this is the person's first flare:
 * their hosted flares have loaded and there are none (upcoming, live or ended
 * in the last 14 days, which is what GET /events/mine/upcoming returns), and
 * this device has never lit one. Anything unknown gets the soft burst, so
 * someone who has lit flares before never gets the first-flare moment again.
 */
export function pickBurst(input: {
  hostedLoaded: boolean
  hostedCount: number
  litOnDevice: boolean
}): BurstLevel {
  return input.hostedLoaded && input.hostedCount === 0 && !input.litOnDevice
    ? "full"
    : "soft"
}

/** Whether this device has lit a flare before. Storage can throw (private mode). */
export function hasLitOnDevice(): boolean {
  try {
    return window.localStorage.getItem(LIT_ON_DEVICE_KEY) === "1"
  } catch {
    return false
  }
}

export function markLitOnDevice(): void {
  try {
    window.localStorage.setItem(LIT_ON_DEVICE_KEY, "1")
  } catch {
    // Without storage the hosted flares still decide the burst.
  }
}

// ---- colour -----------------------------------------------------------------

export function toneFor(visibility: EventVisibility): FlareTone {
  return visibility === "public" ? "open" : "invite"
}

// ---- the strike ---------------------------------------------------------------

export const STRIKE = {
  /** Share of the strip a strike must cover. */
  minShare: 0.6,
  /** Average speed a strike needs, in px per ms (about a flick). */
  minSpeed: 0.45,
  /** Less travel than this is a tap, which also lights the flare. */
  tapSlop: 8,
} as const

/** "strike" and "tap" light the flare; "fizzle" is a drag too slow or short. */
export type StrikeVerdict = "strike" | "tap" | "fizzle"

export function judgeStrike(input: {
  travelled: number
  range: number
  elapsedMs: number
}): StrikeVerdict {
  if (input.travelled < STRIKE.tapSlop) return "tap"
  const share = input.range > 0 ? input.travelled / input.range : 0
  const speed = input.travelled / Math.max(1, input.elapsedMs)
  return share >= STRIKE.minShare && speed >= STRIKE.minSpeed
    ? "strike"
    : "fizzle"
}

// ---- jitter -----------------------------------------------------------------

/** Deterministic jitter in [0, 1), so the burst looks the same every time. */
export function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}
