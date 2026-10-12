// The lighting moment's rules (#375, #376), kept apart from GSAP and the DOM
// so they can be unit-tested. The direction is recorded in
// docs/decisions/flare-lighting-motion.md: the launch for someone's first
// flare, the wick for every flare after, a strike to light, peach for the
// spark, flame and ring, and cross-fades only under reduced motion.

import type { EventVisibility } from "@/lib/api/events"

/** "launch": someone's first flare. "wick": every flare after. */
export type LightingTake = "launch" | "wick"

/** The lit flare's body takes its map pin's colour (#315). */
export type FlareTone = "invite" | "open"

export type Point = { x: number; y: number }

// ---- which take --------------------------------------------------------------

const LIT_ON_DEVICE_KEY = "sponti.flare-lit.v1"

/**
 * The launch plays only when we know this is the person's first flare: their
 * hosted flares have loaded and there are none (upcoming, live or ended in
 * the last 14 days, which is what GET /events/mine/upcoming returns), and
 * this device has never lit one. Anything unknown falls back to the wick, so
 * someone who has lit flares before never gets the onboarding moment again.
 */
export function pickLightingTake(input: {
  hostedLoaded: boolean
  hostedCount: number
  litOnDevice: boolean
}): LightingTake {
  return input.hostedLoaded && input.hostedCount === 0 && !input.litOnDevice
    ? "launch"
    : "wick"
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
    // Without storage the hosted flares still decide the take.
  }
}

// ---- how big ------------------------------------------------------------------

export const BURST = {
  soft: { sparks: 10, reach: [34, 58], waves: 1, pop: 1.06, glow: 0.3 },
  full: { sparks: 18, reach: [74, 118], waves: 2, pop: 1.16, glow: 0.5 },
} as const

export type BurstLevel = keyof typeof BURST

/** The first flare gets the full burst, every flare after the soft one. */
export function burstFor(take: LightingTake): BurstLevel {
  return take === "launch" ? "full" : "soft"
}

export function toneFor(visibility: EventVisibility): FlareTone {
  return visibility === "public" ? "open" : "invite"
}

// ---- what plays ---------------------------------------------------------------

export type LightingStep =
  | "fuse" // the wick burns, or the launch flies, up to the flare
  | "burst" // the flare catches
  | "dots" // the launch's ring of dots lights, pulses and fades away
  | "fade-in" // reduced motion: the lit flare fades in, nothing moves
  | "hold" // the lit flare stays a moment
  | "fade-out" // the moment hands back to the map

/**
 * The steps a moment plays. Reduced motion keeps the same story with
 * cross-fades only: nothing travels, scales, flickers or flies.
 */
export function lightingSteps(
  take: LightingTake,
  reduced: boolean
): LightingStep[] {
  if (reduced) {
    return take === "launch"
      ? ["fade-in", "dots", "hold", "fade-out"]
      : ["fade-in", "hold", "fade-out"]
  }
  return take === "launch"
    ? ["fuse", "burst", "dots", "hold", "fade-out"]
    : ["fuse", "burst", "hold", "fade-out"]
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

// ---- shapes -------------------------------------------------------------------

const round = (n: number) => Math.round(n * 10) / 10

/**
 * The wick: one S-shaped rope from `from` (the flare button) up to `to` (the
 * bottom of the flare's circle), made of two cubic curves that meet with a
 * vertical tangent half way, swayed sideways by `sway` px.
 */
export function wickPath(from: Point, to: Point, sway: number): string {
  const dy = from.y - to.y
  const mid = { x: (from.x + to.x) / 2 + sway, y: (from.y + to.y) / 2 }
  return [
    `M${round(from.x)} ${round(from.y)}`,
    `C${round(from.x)} ${round(from.y - dy * 0.25)}`,
    `${round(mid.x)} ${round(mid.y + dy * 0.2)}`,
    `${round(mid.x)} ${round(mid.y)}`,
    `C${round(mid.x)} ${round(mid.y - dy * 0.2)}`,
    `${round(to.x)} ${round(to.y + dy * 0.25)}`,
    `${round(to.x)} ${round(to.y)}`,
  ].join(" ")
}

/** The launch: one curved trail from the flare button up to the flare. */
export function launchPath(from: Point, to: Point, lean: number): string {
  const dy = from.y - to.y
  return [
    `M${round(from.x)} ${round(from.y)}`,
    `C${round(from.x)} ${round(from.y - dy * 0.5)}`,
    `${round(to.x + lean)} ${round(to.y + dy * 0.35)}`,
    `${round(to.x)} ${round(to.y)}`,
  ].join(" ")
}

/**
 * The launch's dots: evenly spaced on a tight ring around the flare, so they
 * read as light reaching out, never as anyone's position on the map.
 */
export function dotRing(center: Point, radius: number, count = 5): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2
    return {
      x: round(center.x + Math.cos(a) * radius),
      y: round(center.y + Math.sin(a) * radius),
    }
  })
}

/** Deterministic jitter in [0, 1), so the burst looks the same every time. */
export function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}
