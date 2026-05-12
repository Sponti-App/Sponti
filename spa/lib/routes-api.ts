// Thin client for Google's Routes API v2 (computeRoutes).
//
// Why this exists: the legacy DirectionsService is being deprecated and the
// new Routes API gives us the route polyline + duration in one call. We call
// it directly from the client for the prototype — the API key is already
// exposed in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for map rendering. Before
// production, this should be proxied through `api/` so the key can be
// scoped/rate-limited server-side and so the client can fall back gracefully
// when Routes API quota is exhausted.

import type { GeoCoords } from "./geolocation"

export type TravelMode = "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT"

export type RouteResult = {
  // Decoded LatLng path ready to feed into a google.maps.Polyline
  path: GeoCoords[]
  durationSeconds: number
  distanceMeters: number
  // Human-friendly ETA label, e.g. "12 min"
  etaLabel: string
  // Human-friendly distance, e.g. "1.2 mi"
  distanceLabel: string
}

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"

const FIELD_MASK =
  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"

export async function computeRoute(
  origin: GeoCoords,
  destination: GeoCoords,
  travelMode: TravelMode = "WALK",
  signal?: AbortSignal,
): Promise<RouteResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set")
  }

  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: {
      location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
    },
    travelMode,
    // Routing prefs only apply to DRIVE — Routes API ignores otherwise.
    routingPreference: travelMode === "DRIVE" ? "TRAFFIC_AWARE" : undefined,
    polylineQuality: "OVERVIEW",
    languageCode: "en-US",
    units: "IMPERIAL",
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Routes API error ${res.status}: ${text || res.statusText}`)
  }

  const json = (await res.json()) as {
    routes?: Array<{
      duration?: string
      distanceMeters?: number
      polyline?: { encodedPolyline?: string }
    }>
  }
  const route = json.routes?.[0]
  if (!route?.polyline?.encodedPolyline) {
    throw new Error("Routes API returned no route")
  }

  const durationSeconds = parseDuration(route.duration)
  const distanceMeters = route.distanceMeters ?? 0
  const path = decodePolyline(route.polyline.encodedPolyline)

  return {
    path,
    durationSeconds,
    distanceMeters,
    etaLabel: formatDurationLabel(durationSeconds),
    distanceLabel: formatDistanceLabel(distanceMeters),
  }
}

// Routes API returns durations like "523s". Parse to seconds.
function parseDuration(value: string | undefined): number {
  if (!value) return 0
  const match = /^(\d+)s$/.exec(value)
  return match ? Number(match[1]) : 0
}

export function formatDurationLabel(seconds: number): string {
  if (seconds < 60) return "< 1 min"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem === 0 ? `${hours} hr` : `${hours}h ${rem}m`
}

export function formatDistanceLabel(meters: number): string {
  const miles = meters / 1609.344
  if (miles < 0.1) return `${Math.round(meters)} m`
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

// Standard Google polyline algorithm — adapted from the published spec.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function decodePolyline(encoded: string): GeoCoords[] {
  const path: GeoCoords[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    path.push({ lat: lat * 1e-5, lng: lng * 1e-5 })
  }
  return path
}
