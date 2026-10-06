"use client"

import { useSyncExternalStore } from "react"
import type { GeoCoords } from "@/lib/geolocation"

// #408 (behind `locationAsk`): where the map starts, decided once per device.
// Either the person's location (asked for only after they tap "use my
// location") or an area they picked: a berlin neighbourhood chip, or a place
// from the search. Device-only: one localStorage key, never sent to the
// backend.
//
// Same storage pattern as the intro slides (#377, `intro-slides.ts`): every
// storage call is wrapped, because localStorage can be missing or throw
// (private windows, blocked site data). Then `memory` keeps the choice for the
// rest of the session, so the ask still goes away once answered.

export const LOCATION_CHOICE_KEY = "sponti.location-choice.v1"

/** A place the map can start on instead of the person's position. */
export type StartArea = {
  /** A berlin area's slug, or a searched place's id. */
  id: string
  /** Lowercase, as the chips and the banner show it. */
  name: string
  center: GeoCoords
}

export type LocationChoice =
  | { kind: "location" }
  | { kind: "area"; area: StartArea }

/** Where a map sits behind the ask, with no position and no pick yet:
 * kreuzberg, among the berlin idea spots (the signed-out map's centre). */
export const BERLIN_START: GeoCoords = { lat: 52.5, lng: 13.42 }

/** The berlin neighbourhoods the ask offers as chips. The idea spots
 * (`flare-ideas.data.ts`) are all in berlin, so these are where they are. */
export const BERLIN_AREAS: readonly StartArea[] = [
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

function isCoords(value: unknown): value is GeoCoords {
  if (typeof value !== "object" || value === null) return false
  const { lat, lng } = value as Partial<GeoCoords>
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180
  )
}

function isArea(value: unknown): value is StartArea {
  if (typeof value !== "object" || value === null) return false
  const area = value as Partial<StartArea>
  return (
    typeof area.id === "string" &&
    area.id.length > 0 &&
    typeof area.name === "string" &&
    area.name.trim().length > 0 &&
    isCoords(area.center)
  )
}

/** A stored value, or null when there is none or it doesn't parse: then the
 * ask shows again rather than starting the map somewhere wrong. */
export function parseLocationChoice(raw: string | null): LocationChoice | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (typeof value !== "object" || value === null) return null
    const choice = value as { kind?: unknown; area?: unknown }
    if (choice.kind === "location") return { kind: "location" }
    if (choice.kind === "area" && isArea(choice.area)) {
      const { id, name, center } = choice.area
      return {
        kind: "area",
        area: { id, name, center: { lat: center.lat, lng: center.lng } },
      }
    }
    return null
  } catch {
    return null
  }
}

// `undefined`: storage not read yet (or another tab changed it). A string
// is the raw value, kept so the snapshot stays the same object until the
// choice actually changes (useSyncExternalStore compares by reference).
let memoryRaw: string | null | undefined
let cached: { raw: string | null; choice: LocationChoice | null } | undefined
const listeners = new Set<() => void>()

function readRaw(): string | null {
  if (memoryRaw !== undefined) return memoryRaw
  try {
    return window.localStorage.getItem(LOCATION_CHOICE_KEY)
  } catch {
    return null
  }
}

/** The choice this device made, or null while it hasn't decided. */
export function readLocationChoice(): LocationChoice | null {
  const raw = readRaw()
  if (cached && cached.raw === raw) return cached.choice
  cached = { raw, choice: parseLocationChoice(raw) }
  return cached.choice
}

/** Remember where the map starts on this device. */
export function rememberLocationChoice(choice: LocationChoice): void {
  const raw = JSON.stringify(choice)
  memoryRaw = raw
  try {
    window.localStorage.setItem(LOCATION_CHOICE_KEY, raw)
  } catch {
    // Not stored: `memoryRaw` carries it until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== LOCATION_CHOICE_KEY) return
    memoryRaw = undefined
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** The stored choice; null on the server and while undecided. */
export function useLocationChoice(): LocationChoice | null {
  return useSyncExternalStore(subscribe, readLocationChoice, () => null)
}

/** Test seam: forget the in-memory state so storage is read again. */
export function resetLocationChoiceMemory(): void {
  memoryRaw = undefined
  cached = undefined
}
