// Thin client for our backend's Routes API proxy at POST /maps/route. The
// backend (api/src/services/mapsService.ts) calls Google's Routes API v2 with
// the server-held GOOGLE_MAPS_API_KEY so the key never ships to the SPA.
//
// Server returns `encodedPolyline` (Google's compact format) so we get the
// bytes-saving benefit over the wire and the decode happens here. We also
// format the human-readable labels (etaLabel / distanceLabel) client-side so
// the server only owns transport — formatters belong with the UI.

import type { GeoCoords } from "./geolocation"
import { apiFetch } from "./http"

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

type ComputeRouteResponse = {
  data: {
    encodedPolyline: string
    durationSeconds: number
    distanceMeters: number
  }
}

export async function computeRoute(
  origin: GeoCoords,
  destination: GeoCoords,
  travelMode: TravelMode = "WALK",
  signal?: AbortSignal,
): Promise<RouteResult> {
  const res = await apiFetch<ComputeRouteResponse>("/maps/route", {
    method: "POST",
    body: { origin, destination, travelMode },
    signal,
  })

  const { encodedPolyline, durationSeconds, distanceMeters } = res.data
  const path = decodePolyline(encodedPolyline)

  return {
    path,
    durationSeconds,
    distanceMeters,
    etaLabel: formatDurationLabel(durationSeconds),
    distanceLabel: formatDistanceLabel(distanceMeters),
  }
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
