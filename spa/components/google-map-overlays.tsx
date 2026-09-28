"use client"

// Small overlays for @vis.gl/react-google-maps maps, shared by the home map
// and the flare detail page's map hero (#139).

import { useEffect, useRef } from "react"
import { useMap } from "@vis.gl/react-google-maps"
import type { GeoCoords } from "@/lib/geolocation"

// Hex equivalent of --accent (oklch 0.8041 0.126 52.09). Google Maps overlays
// can't read CSS variables, so we mirror the token here. Keep in sync with
// globals.css.
export const ACCENT_HEX = "#f8b187"

export function GoogleMapPolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap()
  useEffect(() => {
    if (!map || path.length === 0) return
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: ACCENT_HEX,
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    })
    return () => {
      polyline.setMap(null)
    }
  }, [map, path])
  return null
}

export function FitBoundsOnce({
  origin,
  destination,
  padding = 80,
}: {
  origin: GeoCoords | null
  destination: GeoCoords | null
  padding?: number | google.maps.Padding
}) {
  const map = useMap()
  const lastKey = useRef<string | null>(null)
  useEffect(() => {
    if (!map || !origin || !destination) return
    const key = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`
    if (lastKey.current === key) return
    lastKey.current = key
    const bounds = new google.maps.LatLngBounds()
    bounds.extend(origin)
    bounds.extend(destination)
    map.fitBounds(bounds, padding)
  }, [map, origin, destination, padding])
  return null
}
