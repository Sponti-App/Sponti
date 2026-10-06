import { haversineMeters } from "@/lib/api/events/events.adapter"
import type { GeoCoords, GeoStatus } from "@/lib/geolocation"
import {
  BERLIN_AREAS,
  type LocationChoice,
  type StartArea,
} from "@/lib/location-choice"

// #408: the pure part of the location ask. Which state the map's sheet is
// in, whether the map may ask the browser for a position, and where the
// camera starts. `use-location-start.ts` wires these to the hooks.

/** What the Permissions API says about geolocation. "unknown" until it
 * answers; "prompt" also when it can't answer (no Permissions API). */
export type GeoPermission = "unknown" | "prompt" | "granted" | "denied"

export type LocationAskInput = {
  /** The `locationAsk` flag. */
  enabled: boolean
  choice: LocationChoice | null
  permission: GeoPermission
  /** The person tapped "use my location" (in the ask or the banner). */
  requested: boolean
  geoStatus: GeoStatus
}

/** The position request failed: denied, blocked, unavailable or timed out. */
export function geoFailed(status: GeoStatus): boolean {
  return status === "denied" || status === "unavailable" || status === "error"
}

/**
 * Whether the map may ask the browser for a position on its own. Flag off:
 * `byDefault`, which is today's behaviour (the signed-in map asks on mount,
 * the signed-out map never does). Flag on: only once the person chose their
 * location, or when the browser already allows it, so the prompt never comes
 * before the tap.
 */
export function locationAutoRequest({
  enabled,
  choice,
  permission,
  byDefault,
}: Pick<LocationAskInput, "enabled" | "choice" | "permission"> & {
  byDefault: boolean
}): boolean {
  if (!enabled) return byDefault
  if (choice) return choice.kind === "location"
  return permission === "granted"
}

/**
 * The sheet's state: hidden, the ask ("where should the map start?"), or the
 * area picker once location is denied or blocked ("pick an area to start").
 */
export function locationAskMode({
  enabled,
  choice,
  permission,
  requested,
  geoStatus,
}: LocationAskInput): "hidden" | "ask" | "pick" {
  if (!enabled || choice) return "hidden"
  // Wait for the Permissions API, so the sheet doesn't flash for someone the
  // browser already lets through.
  if (permission === "unknown" || permission === "granted") return "hidden"
  if (geoStatus === "granted") return "hidden"
  if (permission === "denied") return "pick"
  if (requested && geoFailed(geoStatus)) return "pick"
  return "ask"
}

/** A position arrived and the device hasn't remembered "location" yet. */
export function shouldRememberLocation({
  enabled,
  choice,
  geoStatus,
}: Pick<LocationAskInput, "enabled" | "choice" | "geoStatus">): boolean {
  return enabled && geoStatus === "granted" && choice?.kind !== "location"
}

/**
 * Where the camera starts. Flag off: today's `coords ?? lastKnownCoords`.
 * Flag on: the live position first, then a picked area, then the last known
 * position (when `useLastKnown`), then `fallback` while the ask is open or
 * when one is always wanted (the signed-out map's berlin). Null means "no
 * camera yet" (the signed-in map's "finding your location").
 */
export function startCamera({
  enabled,
  choice,
  coords,
  lastKnown,
  useLastKnown,
  asking,
  fallback,
  alwaysFallback,
}: {
  enabled: boolean
  choice: LocationChoice | null
  coords: GeoCoords | null
  lastKnown: GeoCoords | null
  useLastKnown: boolean
  asking: boolean
  fallback: GeoCoords
  alwaysFallback: boolean
}): GeoCoords | null {
  const known = useLastKnown ? lastKnown : null
  if (!enabled) return coords ?? known ?? (alwaysFallback ? fallback : null)
  if (coords) return coords
  if (choice?.kind === "area") return choice.area.center
  if (known) return known
  return asking || alwaysFallback ? fallback : null
}

/** The berlin chips whose name contains the query (all of them for none). */
export function matchAreas(query: string): StartArea[] {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return [...BERLIN_AREAS]
  // "neukolln" and "neukoelln" find neukölln too.
  const plain = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/oe/g, "o")
  return BERLIN_AREAS.filter(
    (a) =>
      a.name.includes(q) || plain(a.name).includes(plain(q)) || a.id.includes(q)
  )
}

const BERLIN_CENTER: GeoCoords = { lat: 52.52, lng: 13.405 }
// Generous enough for every idea spot in `flare-ideas.data.ts`, which all sit
// inside the ring.
const BERLIN_RADIUS_M = 25_000

/** Idea spots are berlin-only for now: elsewhere the map starts empty. */
export function hasIdeaSpots(center: GeoCoords): boolean {
  return haversineMeters(center, BERLIN_CENTER) <= BERLIN_RADIUS_M
}

/** A search suggestion that reads like a berlin place ("…, berlin, germany"). */
export function looksLikeBerlin(label: string, address: string): boolean {
  return /\bberlin\b/i.test(`${label} ${address}`)
}
