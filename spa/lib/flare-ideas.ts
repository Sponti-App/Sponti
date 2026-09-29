// Picks which idea flares (#240) are worth showing for a position, a date and
// optionally a category. Pure: no clock, no network, no rendering — `now` is a
// parameter so results are deterministic.

import { haversineMeters } from "@/lib/api/events/events.adapter"
import type { EventType } from "@/lib/api/events"
import type { GeoCoords } from "@/lib/geolocation"

import { FLARE_IDEAS, type FlareIdea } from "./flare-ideas.data"

export type { FlareIdea } from "./flare-ideas.data"

export const DEFAULT_IDEA_RADIUS_KM = 2

// The curated list is berlin-only, so season windows are read against the
// berlin calendar day, whatever timezone the device reports.
const SEASON_TIME_ZONE = "Europe/Berlin"

const monthDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEASON_TIME_ZONE,
  month: "2-digit",
  day: "2-digit",
})

/** "MM-DD" of `now` on the berlin calendar. */
function monthDay(now: Date): string {
  const parts = monthDayFormat.formatToParts(now)
  const month = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  return `${month}-${day}`
}

/** True when `now` falls inside the idea's yearly window, ends included. An
 * idea without a season has no window, so it is never "in season". A window
 * whose `from` is after its `to` wraps the new year. */
export function isInSeason(idea: FlareIdea, now: Date): boolean {
  if (!idea.season) return false
  const { from, to } = idea.season
  const today = monthDay(now)
  return from <= to
    ? today >= from && today <= to
    : today >= from || today <= to
}

export type GetIdeasNearOptions = {
  center: GeoCoords
  now: Date
  radiusKm?: number
  category?: EventType
  limit?: number
  /** Defaults to the curated berlin list; tests pass their own. */
  ideas?: readonly FlareIdea[]
}

/**
 * Ideas within `radiusKm` of `center`, nearest first, with ideas whose season
 * is active right now ahead of the rest. An idea with a season only appears
 * while `now` is inside its window, however close it is.
 */
export function getIdeasNear({
  center,
  now,
  radiusKm = DEFAULT_IDEA_RADIUS_KM,
  category,
  limit,
  ideas = FLARE_IDEAS,
}: GetIdeasNearOptions): FlareIdea[] {
  const radiusMeters = radiusKm * 1000

  const ranked = ideas
    .filter((idea) => (category ? idea.category === category : true))
    .filter((idea) => !idea.season || isInSeason(idea, now))
    .map((idea) => ({
      idea,
      inSeason: isInSeason(idea, now),
      meters: haversineMeters(center, idea.place),
    }))
    .filter(({ meters }) => meters <= radiusMeters)
    .sort(
      (a, b) =>
        Number(b.inSeason) - Number(a.inSeason) ||
        a.meters - b.meters ||
        a.idea.id.localeCompare(b.idea.id)
    )
    .map(({ idea }) => idea)

  return limit === undefined ? ranked : ranked.slice(0, Math.max(0, limit))
}
