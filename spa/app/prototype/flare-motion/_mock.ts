// PROTOTYPE (#371) — throwaway. The prototype's knobs and a stand-in for
// the api call that creates the flare. Nothing here reaches a backend.

import type { EventType } from "@/lib/api/events"
import { EVENT_TYPES } from "@/types/utils"

export const GESTURES = [
  { key: "hold", label: "hold" },
  { key: "strike", label: "strike" },
] as const
export type Gesture = (typeof GESTURES)[number]["key"]

export const BURSTS = [
  { key: "soft", label: "soft" },
  { key: "medium", label: "medium" },
  { key: "big", label: "big" },
] as const
export type Burst = (typeof BURSTS)[number]["key"]

/** Burst colours: peach only, or peach plus the map pin's plum/teal (#315). */
export const COLOURS = [
  { key: "peach", label: "peach" },
  { key: "pins", label: "pin colours" },
] as const
export type Colour = (typeof COLOURS)[number]["key"]

export const BURNOUTS = [
  { key: "ash", label: "fade to ash" },
  { key: "ember", label: "ember retreats" },
] as const
export type Burnout = (typeof BURNOUTS)[number]["key"]

/** system = follow prefers-reduced-motion; reduce/full force it. */
export const MOTIONS = [
  { key: "system", label: "system" },
  { key: "reduce", label: "reduced" },
  { key: "full", label: "full" },
] as const
export type Motion = (typeof MOTIONS)[number]["key"]

export const WHO = [
  { key: "invite", label: "invite only" },
  { key: "open", label: "open to all" },
] as const
export type Who = (typeof WHO)[number]["key"]

/** How the stand-in api answers once the fuse reaches the end. */
export const APIS = [
  { key: "fast", label: "api fast" },
  { key: "slow", label: "api slow" },
  { key: "fail", label: "api fails" },
] as const
export type Api = (typeof APIS)[number]["key"]

export const CATEGORIES = EVENT_TYPES.map((t) => ({
  key: t.value,
  label: t.label,
  icon: t.icon,
}))

export type Settings = {
  gesture: Gesture
  burst: Burst
  colour: Colour
  burnout: Burnout
  motion: Motion
  who: Who
  api: Api
  icon: EventType
}

export const DEFAULTS: Settings = {
  gesture: "hold",
  burst: "medium",
  colour: "peach",
  burnout: "ash",
  motion: "system",
  who: "invite",
  api: "fast",
  icon: "drinks",
}

/** The flare being lit, as the composer would hand it over. */
export const MOCK_FLARE = {
  title: "after-work drinks",
  place: "klunkerkranich",
  when: "now",
}

const LATENCY: Record<Api, number> = { fast: 350, slow: 2200, fail: 900 }

/**
 * Stand-in for `createEvent`. The burst only plays once this resolves, so
 * the moment never celebrates a flare the api refused.
 */
export function createFlareMock(api: Api): Promise<void> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (api === "fail") reject(new Error("prototype: api failed"))
      else resolve()
    }, LATENCY[api])
  })
}
