// PROTOTYPE (#615) — throwaway. Local mock flares around Kreuzberg for the
// flare drawer prototype. Nothing here talks to the api.

import type { EventType } from "@/lib/api/events"
import type { FlareTiming, FlareViewer } from "@/lib/flare-detail"

export type LatLng = { lat: number; lng: number }

export type MockGuest = {
  name: string
  /** Host only: arrival answer, as the api only sends it to the host. */
  arrival?: string
}

export type MockUpdate = { author: string; text: string; ago: string }

export type MockFlare = {
  id: string
  title: string
  type: EventType
  visibility: "private" | "public"
  timing: FlareTiming
  /** "now · 6:40pm", "sat · 11am" */
  when: string
  /** "until 11pm", or null for an open end (#614: show the start only). */
  until: string | null
  statusLine: string
  host: string
  note: string
  place: { name: string; area: string; travel: string }
  coords: LatLng
  guests: MockGuest[]
  updates: MockUpdate[]
}

/** Where the viewer is (Kottbusser Tor). The map must never jump back here. */
export const VIEWER: LatLng = { lat: 52.4991, lng: 13.4181 }

export const FLARES: MockFlare[] = [
  {
    id: "rooftop",
    title: "drinks on the roof",
    type: "drinks",
    visibility: "private",
    timing: "live",
    when: "now · 6:40pm",
    until: null,
    statusLine: "started 20 min ago",
    host: "lina",
    note: "we're by the stairs, bring a layer",
    place: {
      name: "klunkerkranich",
      area: "neukölln",
      travel: "18 min walk",
    },
    coords: { lat: 52.4813, lng: 13.4316 },
    guests: [
      { name: "jonas", arrival: "here" },
      { name: "mira", arrival: "15 min" },
      { name: "theo", arrival: "running late" },
    ],
    updates: [
      { author: "lina", text: "got the corner table", ago: "12 min" },
      { author: "jonas", text: "sunset is unreal right now", ago: "4 min" },
    ],
  },
  {
    id: "picnic",
    title: "picnic on the field",
    type: "food",
    visibility: "public",
    timing: "soon",
    when: "today · 7:30pm",
    until: "until 10pm",
    statusLine: "starts in 50 min",
    host: "sam",
    note: "",
    place: {
      name: "tempelhofer feld",
      area: "east entrance, oderstraße",
      travel: "2.6 km away",
    },
    coords: { lat: 52.4747, lng: 13.4178 },
    guests: [{ name: "ana" }],
    updates: [],
  },
  {
    id: "flea",
    title: "flea market crawl",
    type: "hangout",
    visibility: "private",
    timing: "later",
    when: "sat · 11am",
    until: "until 3pm",
    statusLine: "in 4 days",
    host: "noor",
    note: "meeting at the swings",
    place: {
      name: "mauerpark",
      area: "prenzlauer berg",
      travel: "5.3 km away",
    },
    coords: { lat: 52.5433, lng: 13.4023 },
    guests: [{ name: "kai" }, { name: "lina" }],
    updates: [{ author: "noor", text: "bring cash!", ago: "1 day" }],
  },
]

export type Origin = "map" | "calendar" | "link"

export const ORIGINS: { key: Origin; label: string }[] = [
  { key: "map", label: "from map" },
  { key: "calendar", label: "from calendar" },
  { key: "link", label: "from link" },
]

export const VIEWERS: { key: FlareViewer; label: string }[] = [
  { key: "invited", label: "invited" },
  { key: "joined", label: "joined" },
  { key: "host", label: "host" },
]
