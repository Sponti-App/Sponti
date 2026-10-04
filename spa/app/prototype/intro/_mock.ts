// PROTOTYPE (#373) — throwaway. Mock data only: no api, no auth, no
// geolocation. Times are relative to the prototype clock so live / soon
// chips stay true while you click around.

import type { EventItem, EventType, EventVisibility } from "@/lib/api/events"
import { getIdeasNear, type FlareIdea } from "@/lib/flare-ideas"
import type { GeoCoords } from "@/lib/geolocation"

const MIN = 60_000

export type MockPerson = { name: string; color: string }

export const PEOPLE = {
  mia: { name: "Mia Hoffmann", color: "oklch(0.7 0.12 20)" },
  jonas: { name: "Jonas Weber", color: "oklch(0.7 0.1 250)" },
  lena: { name: "Lena Schulz", color: "oklch(0.72 0.11 150)" },
  sam: { name: "Sam Okafor", color: "oklch(0.7 0.1 300)" },
} satisfies Record<string, MockPerson>

export const YOU = { name: "Alex Brandt", first: "alex", handle: "alexb" }

function flare({
  id,
  title,
  type,
  visibility,
  host,
  startIn,
  lengthMin,
  place,
  going,
  coordinates,
}: {
  id: string
  title: string
  type: EventType
  visibility: EventVisibility
  host: MockPerson
  startIn: number
  lengthMin: number
  place: string
  going: number
  coordinates: [number, number]
}): (now: number) => EventItem {
  return (now) => {
    const start = now + startIn * MIN
    return {
      id,
      title,
      type,
      visibility,
      startAt: new Date(start).toISOString(),
      endAt: new Date(start + lengthMin * MIN).toISOString(),
      host: {
        id: `host-${id}`,
        name: host.name,
        avatar: host.name.slice(0, 2),
        color: host.color,
        note: "",
      },
      location: { name: place, coordinates },
      attendees: [],
      going,
    }
  }
}

const FLARES = [
  flare({
    id: "canal",
    title: "drinks at the canal",
    type: "drinks",
    visibility: "public",
    host: PEOPLE.mia,
    startIn: -20,
    lengthMin: 120,
    place: "Admiralbrücke",
    going: 3,
    coordinates: [13.4151, 52.4953],
  }),
  flare({
    id: "climb",
    title: "bouldering session",
    type: "sports",
    visibility: "private",
    host: PEOPLE.jonas,
    startIn: 45,
    lengthMin: 90,
    place: "Ostbloc",
    going: 2,
    coordinates: [13.4795, 52.5011],
  }),
  flare({
    id: "pho",
    title: "pho at dong xuan",
    type: "food",
    visibility: "private",
    host: PEOPLE.lena,
    startIn: -5,
    lengthMin: 60,
    place: "Dong Xuan Center",
    going: 4,
    coordinates: [13.4895, 52.5372],
  }),
]

export function mockFlares(now: number): EventItem[] {
  return FLARES.map((f) => f(now))
}

/** Upcoming flares for the "soon" fragments: a picked time, later today or
 * this week. `day` is the calendar row's day label. */
export const SOON = [
  {
    flare: flare({
      id: "flea",
      title: "flea market at mauerpark",
      type: "hobby",
      visibility: "public",
      host: PEOPLE.sam,
      startIn: 26 * 60,
      lengthMin: 180,
      place: "Mauerpark",
      going: 5,
      coordinates: [13.4024, 52.5435],
    }),
    day: "tomorrow",
  },
  {
    flare: flare({
      id: "film",
      title: "open-air film at hasenheide",
      type: "culture",
      visibility: "private",
      host: PEOPLE.lena,
      startIn: 3 * 24 * 60,
      lengthMin: 150,
      place: "Freiluftkino Hasenheide",
      going: 3,
      coordinates: [13.4183, 52.4847],
    }),
    day: "fri",
  },
]

/** The visitor's own flare, lit from an idea spot (or the plain draft). */
export function ownFlare(now: number, idea: FlareIdea): EventItem {
  return flare({
    id: "yours",
    title: idea.title,
    type: idea.category,
    visibility: "private",
    host: { name: YOU.name, color: "oklch(0.8 0.12 52)" },
    startIn: 0,
    lengthMin: 120,
    place: idea.place.name,
    going: 0,
    coordinates: [idea.place.lng, idea.place.lat],
  })(now)
}

// "pick an area" fallback. The idea spots are berlin-only, so the chips are
// too. The search field finds anything; outside berlin the map starts empty
// (no idea spots), which is a decision on the PR.
export const AREAS: { id: string; name: string; center: GeoCoords }[] = [
  { id: "kreuzberg", name: "kreuzberg", center: { lat: 52.4986, lng: 13.403 } },
  { id: "neukoelln", name: "neukölln", center: { lat: 52.4811, lng: 13.435 } },
  {
    id: "friedrichshain",
    name: "friedrichshain",
    center: { lat: 52.5159, lng: 13.4544 },
  },
  { id: "mitte", name: "mitte", center: { lat: 52.52, lng: 13.405 } },
  {
    id: "prenzlauer-berg",
    name: "prenzlauer berg",
    center: { lat: 52.5389, lng: 13.4243 },
  },
  { id: "wedding", name: "wedding", center: { lat: 52.55, lng: 13.3667 } },
]

export const DEFAULT_AREA = AREAS[0]

/** Before the location ask the map has no position: it opens on berlin. */
export const BERLIN = { lat: 52.515, lng: 13.41 }

/** What the prototype's search finds for anything that isn't a berlin area. */
export function awayArea(query: string) {
  const name = query.trim().toLowerCase() || "hamburg"
  return { id: "away", name, center: { lat: 53.55, lng: 9.99 } }
}

/** What `firstFlarePrefill` would pick: the nearest idea spot, via the real
 * pure `getIdeasNear`, with a fallback so the mock never renders empty. */
export function nearestIdea(center: GeoCoords, now: number): FlareIdea {
  const [idea] = getIdeasNear({
    center,
    now: new Date(now),
    limit: 1,
    radiusKm: 5,
  })
  return (
    idea ?? {
      id: "fallback",
      title: "climb the hill at viktoriapark",
      blurb: "a view over kreuzberg and a waterfall on the way",
      category: "hangout",
      place: { name: "Viktoriapark", lat: 52.4875, lng: 13.3808 },
    }
  )
}

/** A few idea spots for the map backdrops. */
export function ideasNear(center: GeoCoords, now: number): FlareIdea[] {
  return getIdeasNear({ center, now: new Date(now), limit: 3, radiusKm: 5 })
}
