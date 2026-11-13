// "Search this area" (#642): which point the idea spots are picked around.
// By default that is "me" (the person's own position); after a tap on the
// button it is the map's centre at that moment. `ideaCenter` is the single
// value the spot pick reads (#563 builds its precise spots on it). The floating
// "anywhere" ideas ignore it and stay on the person.

import { useMemo, useState } from "react"

import { haversineMeters } from "@/lib/api/events/events.adapter"
import type { GeoCoords } from "@/lib/geolocation"

/** How far the map centre must be from the idea centre before the button
 * shows. 1 km is about a screen of the signed-in map (zoom 15) and half the
 * first idea radius (2 km), so the button only offers an area that would show
 * different spots, and stays away for a nudge of the thumb. */
export const SEARCH_AREA_MIN_METERS = 1000

export function isFarFrom(a: GeoCoords, b: GeoCoords): boolean {
  return haversineMeters(a, b) > SEARCH_AREA_MIN_METERS
}

export type IdeaArea = {
  /** Where idea spots are picked around: the searched area, else `me`. */
  ideaCenter: GeoCoords | null
  /** The map has moved far enough from `ideaCenter` to offer a search. */
  canSearch: boolean
  /** The map reports its centre (when it stops moving). Panning back to `me`
   * switches the ideas back to it. */
  onMapCenter: (center: GeoCoords) => void
  /** The button: pick spots around the map's current centre. */
  search: () => void
}

export function useIdeaArea(me: GeoCoords | null): IdeaArea {
  const [area, setArea] = useState<GeoCoords | null>(null)
  const [mapCenter, setMapCenter] = useState<GeoCoords | null>(null)
  const lat = area?.lat ?? me?.lat
  const lng = area?.lng ?? me?.lng
  const ideaCenter = useMemo(
    () => (lat != null && lng != null ? { lat, lng } : null),
    [lat, lng]
  )
  return {
    ideaCenter,
    canSearch: !!mapCenter && !!ideaCenter && isFarFrom(mapCenter, ideaCenter),
    onMapCenter: (center) => {
      setMapCenter(center)
      if (me && !isFarFrom(center, me)) setArea(null)
    },
    search: () => {
      if (mapCenter) setArea(mapCenter)
    },
  }
}
