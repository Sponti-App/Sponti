// PROTOTYPE (#563), throwaway. Real spots around humboldthain (the e2e stub's
// berlin position), pulled once from OpenStreetMap's Overpass API on
// 2026-10-14: leisure=pitch with a sport, fitness stations, skateparks,
// viewpoints and climbing, within 900 m. Paired tables are merged into one
// spot, private or customers-only entries are dropped, and the climbing wall
// on the flak tower is folded into its viewpoint (same spot). The OSM entries
// have no names of their own; the labels below are editorial, from the park
// or venue each one sits in.

import type { IdeaIconKey } from "@/lib/idea-icons"

export const CENTER = { lat: 52.5474, lng: 13.3873 }

export type Spot = {
  id: string
  /** What you'd do: the idea's title. */
  title: string
  /** Where it is, short. */
  place: string
  icon: IdeaIconKey
  lat: number
  lng: number
  /** OSM tag it came from, for the PR write-up. */
  osm: string
}

const RAW: Spot[] = [
  {
    id: "view",
    title: "sunset from the flak tower",
    place: "humboldthöhe",
    icon: "binoculars",
    lat: 52.5475,
    lng: 13.38508,
    osm: "tourism=viewpoint",
  },
  {
    id: "pingpong-hain",
    title: "ping-pong",
    place: "humboldthain, 2 tables",
    icon: "ping-pong",
    lat: 52.54642,
    lng: 13.38903,
    osm: "sport=table_tennis",
  },
  {
    id: "pingpong-north",
    title: "ping-pong",
    place: "humboldthain, north side",
    icon: "ping-pong",
    lat: 52.54973,
    lng: 13.38541,
    osm: "sport=table_tennis",
  },
  {
    id: "boulder-magic",
    title: "bouldering",
    place: "magic mountain",
    icon: "climb",
    lat: 52.54857,
    lng: 13.38255,
    osm: "sport=climbing (indoor hall)",
  },
  {
    id: "football-south",
    title: "kick-about",
    place: "pitch south of the park",
    icon: "ball",
    lat: 52.54381,
    lng: 13.38372,
    osm: "sport=soccer",
  },
  {
    id: "hoops-north",
    title: "shoot some hoops",
    place: "court north of the park",
    icon: "ball",
    lat: 52.55184,
    lng: 13.38554,
    osm: "sport=basketball",
  },
  {
    id: "pingpong-south",
    title: "ping-pong",
    place: "south of the park",
    icon: "ping-pong",
    lat: 52.54326,
    lng: 13.38317,
    osm: "sport=table_tennis",
  },
  {
    id: "pingpong-east",
    title: "ping-pong",
    place: "2 tables, east",
    icon: "ping-pong",
    lat: 52.54698,
    lng: 13.39631,
    osm: "sport=table_tennis",
  },
  {
    id: "boulder-elektra",
    title: "bouldering",
    place: "elektra",
    icon: "climb",
    lat: 52.54104,
    lng: 13.38688,
    osm: "sport=climbing (indoor hall)",
  },
  {
    id: "skate",
    title: "skate session",
    place: "small skatepark",
    icon: "sneaker",
    lat: 52.5542,
    lng: 13.38964,
    osm: "leisure=pitch sport=skateboard",
  },
  {
    id: "gym",
    title: "outdoor workout",
    place: "next to the skatepark",
    icon: "run",
    lat: 52.55444,
    lng: 13.38967,
    osm: "leisure=fitness_station",
  },
  {
    id: "calisthenics",
    title: "pull-ups and dips",
    place: "calisthenics park",
    icon: "run",
    lat: 52.54077,
    lng: 13.38101,
    osm: "sport=calisthenics",
  },
  {
    id: "beach",
    title: "beach volleyball",
    place: "sand court",
    icon: "sun-horizon",
    lat: 52.53995,
    lng: 13.39218,
    osm: "sport=beachvolleyball",
  },
]

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LNG = 111_320 * Math.cos((CENTER.lat * Math.PI) / 180)

/** Metres east and north of `CENTER`. */
export function offsetMeters(p: { lat: number; lng: number }) {
  return {
    east: (p.lng - CENTER.lng) * M_PER_DEG_LNG,
    north: (p.lat - CENTER.lat) * M_PER_DEG_LAT,
  }
}

export type NearSpot = Spot & {
  meters: number
  /** Compass bearing from the person, degrees clockwise from north. */
  bearing: number
}

/** Every spot, nearest first. */
export const SPOTS: NearSpot[] = RAW.map((spot) => {
  const { east, north } = offsetMeters(spot)
  const bearing = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360
  return { ...spot, meters: Math.hypot(east, north), bearing }
}).sort((a, b) => a.meters - b.meters)

/** "150 m", rounded to 10 m; "1.2 km" past 1 km. */
export function formatMeters(m: number) {
  return m < 1000
    ? `${Math.round(m / 10) * 10} m`
    : `${(m / 1000).toFixed(1)} km`
}
