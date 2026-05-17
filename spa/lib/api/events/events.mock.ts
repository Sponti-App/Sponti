import type { EventCoordinates, EventItem } from "./events.types"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const now = Date.now()

// Temporary demo events used when the backend is disabled or unavailable.
export const MOCK_EVENTS: EventItem[] = [
  {
    id: "evt-mira",
    title: "coffee at Reuben's",
    type: "drinks",
    startAt: new Date(now - 10 * MIN).toISOString(),
    endAt: new Date(now + 50 * MIN).toISOString(),
    visibility: "public",
    host: {
      name: "Mira",
      avatar: "M",
      color: "bg-accent",
      note: "grabbing a latte before my 4pm",
    },
    location: {
      name: "Reuben's Espresso",
      area: "Fillmore",
      address: "2400 Fillmore St, San Francisco, CA",
      coordinates: [-122.4364, 37.7855],
    },
    attendees: [
      { name: "Mira", avatar: "M", color: "bg-accent" },
      { name: "Sam", avatar: "S", color: "bg-stone-300" },
    ],
    going: 2,
  },
  {
    id: "evt-sam-patio",
    title: "patio hang",
    type: "hangout",
    startAt: new Date(now + 4 * HOUR).toISOString(),
    endAt: new Date(now + 7 * HOUR).toISOString(),
    visibility: "private",
    host: {
      name: "Sam",
      avatar: "S",
      color: "bg-stone-800",
      note: "patio hangs at my place, bring snacks!",
    },
    location: {
      name: "the patio",
      area: "Castro",
      coordinates: [-122.4324, 37.7825],
    },
    attendees: [
      { name: "Sam", avatar: "S", color: "bg-stone-800" },
      { name: "K", avatar: "K", color: "bg-stone-300" },
    ],
    going: 4,
  },
  {
    id: "evt-run-club",
    title: "run club",
    type: "sports",
    startAt: new Date(now + DAY + 2 * HOUR).toISOString(),
    endAt: new Date(now + DAY + 3 * HOUR).toISOString(),
    visibility: "public",
    host: {
      name: "J",
      avatar: "J",
      color: "bg-stone-400",
      note: "meet at the main gate, bring water!",
    },
    location: {
      name: "Dolores Park",
      area: "Mission",
      coordinates: [-122.4271, 37.7596],
    },
    attendees: [{ name: "J", avatar: "J", color: "bg-stone-400" }],
    going: 6,
  },
  {
    id: "evt-bookclub",
    title: "book club",
    type: "hangout",
    startAt: new Date(now + 3 * DAY + 6 * HOUR).toISOString(),
    endAt: new Date(now + 3 * DAY + 8 * HOUR).toISOString(),
    visibility: "private",
    host: {
      name: "Lina",
      avatar: "L",
      color: "bg-stone-500",
      note: "we're on chapter 4 - show up even if you didn't read",
    },
    location: {
      name: "Lina's place",
      area: "Hayes Valley",
      coordinates: [-122.4267, 37.7766],
    },
    attendees: [
      { name: "Lina", avatar: "L", color: "bg-stone-500" },
      { name: "Mira", avatar: "M", color: "bg-accent" },
    ],
    going: 3,
  },
]

// Demo-mode events used when map event API calls fail.
export const DEMO_MAP_EVENTS = MOCK_EVENTS.filter(
  (event) => !!event.location.coordinates
)

// Small lat/lng deltas applied to mock events so they cluster near the user's
// real coordinates rather than appearing in SF for every tester.
const MOCK_OFFSETS: Array<{ dLat: number; dLng: number }> = [
  { dLat: 0.0025, dLng: 0.0015 },
  { dLat: -0.003, dLng: -0.0018 },
  { dLat: 0.001, dLng: -0.004 },
  { dLat: -0.0015, dLng: 0.0035 },
  { dLat: 0.004, dLng: -0.002 },
]

export function repositionMockEvents(
  events: EventItem[],
  userCoords: EventCoordinates | null
): EventItem[] {
  if (!userCoords) return events
  return events.map((event, index) => {
    if (!event.location.coordinates) return event
    const offset = MOCK_OFFSETS[index % MOCK_OFFSETS.length]
    return {
      ...event,
      location: {
        ...event.location,
        coordinates: [
          userCoords.lng + offset.dLng,
          userCoords.lat + offset.dLat,
        ],
      },
    }
  })
}
