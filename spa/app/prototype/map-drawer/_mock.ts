// PROTOTYPE (#223): throwaway. Local mock flares for the map drawer
// prototypes. Nothing here talks to the api; delete with the route once an
// approach is chosen.

import { EVENT_TYPES } from "@/types/utils"
import type { EventType } from "@/lib/api/events"

export type Snap = "peek" | "mid" | "full"
export type TimeTab = "live" | "soon" | "all"

export const SNAPS: { key: Snap; label: string }[] = [
  { key: "peek", label: "peek" },
  { key: "mid", label: "mid" },
  { key: "full", label: "full" },
]
export const TABS: { key: TimeTab; label: string }[] = [
  { key: "live", label: "live" },
  { key: "soon", label: "soon" },
  { key: "all", label: "all" },
]

export type MockFlare = {
  id: string
  title: string
  type: EventType
  host: string
  /** Minutes from now: negative = started that long ago. */
  startsIn: number
  /** Minutes from now until it ends. */
  endsIn: number
  distance: string
  going: number
  joined?: boolean
  /** Position of the pin on the fake map, in % of the map box. */
  pin: { x: number; y: number }
}

export const FLARES: MockFlare[] = [
  { id: "f1", title: "after-work pints", type: "drinks", host: "sarah", startsIn: -25, endsIn: 95, distance: "0.4 km", going: 5, joined: true, pin: { x: 30, y: 30 } },
  { id: "f2", title: "sunset frisbee", type: "sports", host: "tom", startsIn: -10, endsIn: 50, distance: "1.1 km", going: 3, pin: { x: 68, y: 22 } },
  { id: "f3", title: "ramen run", type: "food", host: "maya", startsIn: -5, endsIn: 70, distance: "0.8 km", going: 4, pin: { x: 56, y: 44 } },
  { id: "f4", title: "board games at jo's", type: "hangout", host: "jo", startsIn: -40, endsIn: 140, distance: "2.3 km", going: 6, pin: { x: 20, y: 52 } },
  { id: "f5", title: "rooftop spritz", type: "drinks", host: "leo", startsIn: -15, endsIn: 45, distance: "1.6 km", going: 2, pin: { x: 80, y: 38 } },
  { id: "f6", title: "sketching in the park", type: "hobby", host: "ines", startsIn: -60, endsIn: 30, distance: "0.9 km", going: 3, pin: { x: 42, y: 18 } },
  { id: "f7", title: "gallery late opening", type: "culture", host: "noah", startsIn: 20, endsIn: 140, distance: "2.8 km", going: 7, pin: { x: 74, y: 58 } },
  { id: "f8", title: "wine bar catch-up", type: "drinks", host: "amira", startsIn: 35, endsIn: 155, distance: "1.3 km", going: 3, pin: { x: 36, y: 64 } },
  { id: "f9", title: "tacos on the canal", type: "food", host: "ben", startsIn: 50, endsIn: 170, distance: "0.6 km", going: 4, pin: { x: 62, y: 70 } },
  { id: "f10", title: "house party", type: "party", host: "kai", startsIn: 90, endsIn: 330, distance: "3.1 km", going: 11, pin: { x: 14, y: 72 } },
  { id: "f11", title: "5-a-side", type: "sports", host: "dev", startsIn: 110, endsIn: 170, distance: "2.0 km", going: 8, pin: { x: 86, y: 76 } },
  { id: "f12", title: "coffee & a walk", type: "hangout", host: "lou", startsIn: 140, endsIn: 200, distance: "0.3 km", going: 2, pin: { x: 48, y: 82 } },
]

export function isLive(f: MockFlare) {
  return f.startsIn <= 0
}

export function typeInfo(type: EventType) {
  return EVENT_TYPES.find((t) => t.value === type) ?? EVENT_TYPES[0]
}

export function filterFlares(tab: TimeTab, types: EventType[]): MockFlare[] {
  return FLARES.filter((f) =>
    tab === "all" ? true : tab === "live" ? isLive(f) : !isLive(f)
  ).filter((f) => types.length === 0 || types.includes(f.type))
}

function minutes(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

/** "by sarah · 0.4 km · ending in 1h 35m" (live) or "… · in 20 min". */
export function metaLine(f: MockFlare) {
  const time = isLive(f) ? `ending in ${minutes(f.endsIn)}` : `in ${minutes(f.startsIn)}`
  return `by ${f.host} · ${f.distance} · ${time}`
}

/**
 * The type-aware CTA copy (#223 idea): exactly one type filter on means we
 * suggest lighting a flare of that type; none or several means the plain CTA.
 */
export function ctaFor(types: EventType[]): { label: string; type: EventType | null } {
  if (types.length !== 1) return { label: "light a flare", type: null }
  return { label: `light a ${typeInfo(types[0]).label} flare`, type: types[0] }
}
