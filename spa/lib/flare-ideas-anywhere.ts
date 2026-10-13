// Picks and places the place-less ideas (#515). Pure: no clock, no network, no
// rendering. `now` is a parameter so results are deterministic.
//
// The curated spots (flare-ideas.ts) are tied to a place and only show near
// it. These "anywhere" ideas are tied to nothing, so the map has something to
// tap whatever the neighbourhood or the season. The picker chooses a few that
// fit the day; the placer fans them around a point (the person's own
// position) so they never sit on each other or on a real pin.

import { haversineMeters } from "@/lib/api/events/events.adapter"
import type { EventType } from "@/lib/api/events"
import type { GeoCoords } from "@/lib/geolocation"

import type { FlareIdea } from "./flare-ideas.data"
import {
  ANYWHERE_IDEAS,
  type AnywhereIdea,
  type TimeOfDay,
} from "./flare-ideas.anywhere.data"

export type { AnywhereIdea, TimeOfDay } from "./flare-ideas.anywhere.data"

/** Either kind of idea: a spot, or an idea that is not tied to one. A spot
 * always has `place`; an anywhere idea never does. */
export type Idea = FlareIdea | AnywhereIdea

/** An anywhere idea with the point the map draws it at. */
export type FloatingIdea = AnywhereIdea & { position: GeoCoords }

/** What the idea card says where a spot's name and distance would be. */
export const ANYWHERE_PLACE_LINE = "at your place or wherever you are"

/** Most floating pins at once. Together with the spots (MAX_IDEA_PINS) they
 * stay few enough that ideas don't outnumber the real flares. */
export const MAX_ANYWHERE_PINS = 3

/** The day is cut into slots of this many hours, and the pick changes when the
 * slot does: often enough to rotate over the day, rarely enough that the pins
 * don't change under someone looking at the map. */
export const ROTATION_HOURS = 3

// The device's own clock and calendar decide the season and the time of day:
// these ideas are about the person's evening, wherever they are, unlike the
// berlin spots whose windows are read on the berlin calendar.

/** The part of the day `now` falls in, on the device clock. */
export function timeOfDay(now: Date): TimeOfDay {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  if (hour >= 17 && hour < 22) return "evening"
  return "night"
}

function monthDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${month}-${day}`
}

/** True when the idea has a season and `now` is inside it. */
export function isAnywhereInSeason(idea: AnywhereIdea, now: Date): boolean {
  if (!idea.season) return false
  const { from, to } = idea.season
  const today = monthDay(now)
  return from <= to
    ? today >= from && today <= to
    : today >= from || today <= to
}

// FNV-1a: a small, stable string hash. Math.random would make the pins flicker
// on every render.
function hash01(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // (0, 1): never exactly 0, so the log below is finite.
  return ((h >>> 0) + 1) / 0x1_0000_0001
}

function slotKey(now: Date): string {
  const slot = Math.floor(now.getHours() / ROTATION_HOURS)
  return `${now.getFullYear()}-${monthDay(now)}:${slot}`
}

export type GetAnywhereIdeasOptions = {
  now: Date
  /** Categories to show; empty (no chip on) means every category. */
  categories: ReadonlySet<EventType>
  cap?: number
  /** Defaults to the curated list; tests pass their own. */
  ideas?: readonly AnywhereIdea[]
}

/**
 * Up to `cap` anywhere ideas for `now`. An idea out of season, or hinted for
 * another part of the day, is never picked. Among the rest, in-season ideas
 * and ideas hinted for this part of the day are favoured (a weighted draw, so
 * they are likelier but not the only ones), and the draw is seeded by the day
 * and the slot, so it holds still within a slot and moves on in the next.
 * Ideas of different categories come first so the pins read as different
 * things; a repeated category only fills a gap.
 */
export function getAnywhereIdeas({
  now,
  categories,
  cap = MAX_ANYWHERE_PINS,
  ideas = ANYWHERE_IDEAS,
}: GetAnywhereIdeasOptions): AnywhereIdea[] {
  const part = timeOfDay(now)
  const seed = slotKey(now)

  const ranked = ideas
    .filter((idea) => categories.size === 0 || categories.has(idea.category))
    .filter((idea) => !idea.season || isAnywhereInSeason(idea, now))
    .filter((idea) => !idea.timeOfDay || idea.timeOfDay.includes(part))
    .map((idea) => {
      // Past the filters above, a season means "in season now" and a time
      // hint means "fits this part of the day": each is a reason to favour it.
      const weight = (idea.season ? 3 : 1) * (idea.timeOfDay ? 2 : 1)
      // Weighted sampling without replacement: the smallest key wins, and a
      // bigger weight shrinks the key.
      return {
        idea,
        key: -Math.log(hash01(`${seed}:${idea.id}`)) / weight,
      }
    })
    .sort((a, b) => a.key - b.key || a.idea.id.localeCompare(b.idea.id))
    .map(({ idea }) => idea)

  const limit = Math.max(0, cap)
  const picked: AnywhereIdea[] = []
  const seen = new Set<EventType>()
  for (const idea of ranked) {
    if (picked.length >= limit) break
    if (seen.has(idea.category)) continue
    seen.add(idea.category)
    picked.push(idea)
  }
  for (const idea of ranked) {
    if (picked.length >= limit) break
    if (!picked.includes(idea)) picked.push(idea)
  }
  return picked
}

/** How far from the anchor a floating pin sits on the signed-in map, which
 * opens at street level (about a kilometre across): far enough to clear the
 * position dot, near enough to feel like "around you". */
export const FLOATING_RADIUS_METERS = 220

/** Bearings (degrees clockwise from north) the pins take, in order. The upper
 * half comes first: the dock covers the lower part of the map. */
const FLOATING_BEARINGS = [315, 45, 180, 270, 90, 225, 135, 0] as const

const EARTH_RADIUS_M = 6_371_000

/** The point `meters` from `from`, heading `bearing` degrees clockwise from
 * north. Flat-earth maths is exact enough at a few hundred metres. */
export function offsetCoords(
  from: GeoCoords,
  bearing: number,
  meters: number
): GeoCoords {
  const rad = (bearing * Math.PI) / 180
  const dLat = (meters * Math.cos(rad)) / EARTH_RADIUS_M
  const dLng =
    (meters * Math.sin(rad)) /
    (EARTH_RADIUS_M * Math.cos((from.lat * Math.PI) / 180))
  return {
    lat: from.lat + (dLat * 180) / Math.PI,
    lng: from.lng + (dLng * 180) / Math.PI,
  }
}

export type PlaceFloatingIdeasOptions = {
  anchor: GeoCoords
  ideas: readonly AnywhereIdea[]
  /** Points that already hold a marker (flare pins, idea spots). A bearing
   * whose point would touch one is skipped. */
  obstacles: readonly GeoCoords[]
  radiusMeters?: number
}

/**
 * Fans `ideas` out around `anchor` at fixed bearings, one per bearing, in the
 * order given. A bearing that would land within 40% of the radius of an
 * obstacle is skipped, and an idea that runs out of bearings is dropped. The
 * same input always gives the same points.
 */
export function placeFloatingIdeas({
  anchor,
  ideas,
  obstacles,
  radiusMeters = FLOATING_RADIUS_METERS,
}: PlaceFloatingIdeasOptions): FloatingIdea[] {
  const clearance = radiusMeters * 0.4
  const free = FLOATING_BEARINGS.map((bearing) =>
    offsetCoords(anchor, bearing, radiusMeters)
  ).filter(
    (point) =>
      !obstacles.some(
        (obstacle) => haversineMeters(obstacle, point) < clearance
      )
  )
  return ideas.slice(0, free.length).map((idea, i) => ({
    ...idea,
    position: free[i],
  }))
}
