// PROTOTYPE (#315): local mock data only. No api, no shared database.

import type { EventType, EventVisibility } from "@/lib/api/events"

export type Timing = "live" | "soon"

export type MockPin = {
  id: string
  kind: "flare"
  title: string
  type: EventType
  visibility: EventVisibility
  timing: Timing
  /** "ends in 40 min" for live, "starts 7pm" for soon. */
  timeLabel: string
  /** The short form a pin may carry under it. */
  shortTime: string
  going: number
  distance: string
  host: { name: string; initials: string; hue: number }
  own?: boolean
  joined?: boolean
  /** What the prototype note under the pin says. */
  note: string
  /** Percent of the map area. */
  x: number
  y: number
}

export type MockIdea = {
  id: string
  kind: "idea"
  title: string
  type: EventType
  note: string
  x: number
  y: number
}

// Every private flare on the map is one the viewer was invited to: the api
// only returns private flares where the viewer is the host or a member
// (eventService's `$or: [hostId, public, memberEventIds]`). So a private pin
// may show what the invite already showed (host, title), and never which
// circle it came through: circle names are the host's own labels.
export const PINS: MockPin[] = [
  {
    id: "own",
    kind: "flare",
    title: "picnic at humboldthain",
    type: "hangout",
    visibility: "private",
    timing: "live",
    timeLabel: "ends in 1h 20m",
    shortTime: "live",
    going: 4,
    distance: "0.2 km",
    host: { name: "you", initials: "PC", hue: 52 },
    own: true,
    note: "yours · invite only · live",
    x: 30,
    y: 20,
  },
  {
    id: "private-soon",
    kind: "flare",
    title: "ramen at cocolo",
    type: "food",
    visibility: "private",
    timing: "soon",
    timeLabel: "starts 7pm",
    shortTime: "7pm",
    going: 2,
    distance: "1.1 km",
    host: { name: "jonas", initials: "J", hue: 230 },
    note: "invite only · 7pm",
    x: 29,
    y: 41,
  },
  {
    id: "public-soon",
    kind: "flare",
    title: "gallery opening at kw",
    type: "culture",
    visibility: "public",
    timing: "soon",
    timeLabel: "starts 8pm",
    shortTime: "8pm",
    going: 12,
    distance: "1.6 km",
    host: { name: "lena", initials: "L", hue: 140 },
    note: "open to all · 8pm",
    x: 74,
    y: 39,
  },
  {
    id: "private",
    kind: "flare",
    title: "drinks at klunkerkranich",
    type: "drinks",
    visibility: "private",
    timing: "live",
    timeLabel: "ends in 40 min",
    shortTime: "live",
    going: 3,
    distance: "0.6 km",
    host: { name: "sarah", initials: "SK", hue: 340 },
    note: "invite only · live",
    x: 30,
    y: 64,
  },
  {
    id: "public",
    kind: "flare",
    title: "pickup football at mauerpark",
    type: "sports",
    visibility: "public",
    timing: "live",
    timeLabel: "ends in 1h 10m",
    shortTime: "live",
    going: 6,
    distance: "0.9 km",
    host: { name: "mia", initials: "M", hue: 190 },
    note: "open to all · live",
    x: 72,
    y: 62,
  },
  {
    id: "joined",
    kind: "flare",
    title: "pottery jam",
    type: "hobby",
    visibility: "public",
    timing: "live",
    timeLabel: "ends in 2h",
    shortTime: "live",
    going: 5,
    distance: "1.3 km",
    host: { name: "noah", initials: "N", hue: 280 },
    joined: true,
    note: "joined · open to all · live",
    x: 66,
    y: 82,
  },
]

export const IDEA: MockIdea = {
  id: "idea",
  kind: "idea",
  title: "roses are blooming at humboldthain",
  type: "hangout",
  note: "idea, not a flare",
  x: 72,
  y: 18,
}

/** Where the viewer is, as the blue dot. */
export const ME_DOT = { x: 44, y: 50 }

export type PopoverKey = "none" | "private" | "public"
