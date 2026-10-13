"use client"

import { useMemo } from "react"
import type { EventType } from "@/lib/api/events"
import { featureFlags } from "@/lib/feature-flags"
import {
  FLOATING_RADIUS_METERS,
  getAnywhereIdeas,
  placeFloatingIdeas,
  type FloatingIdea,
} from "@/lib/flare-ideas-anywhere"
import type { GeoCoords } from "@/lib/geolocation"
import { useIdeasHidden } from "@/lib/idea-preferences"

const NO_FLOATING: FloatingIdea[] = []

/**
 * The floating ideas (#515) a map draws around `anchor`: the person's own
 * position, or the map's centre until there is one. None while "show ideas on
 * the map" is off, the `floatingIdeas` flag is off, or the clock hasn't ticked
 * yet (`nowMs` is 0 until the first effect). `obstacles` are the points that
 * already hold a pin.
 *
 * Keyed on primitives, so the pick moves only when its inputs do and not on
 * every render (the position object is a fresh one per fix).
 */
export function useFloatingIdeas({
  anchor,
  nowMs,
  categories,
  obstacles,
  radiusMeters = FLOATING_RADIUS_METERS,
  ready = true,
}: {
  anchor: GeoCoords | null
  nowMs: number
  categories: ReadonlySet<EventType>
  obstacles: readonly GeoCoords[]
  radiusMeters?: number
  /** False while the map is still loading its flares, so a pin never jumps
   * when a flare arrives and takes its bearing. */
  ready?: boolean
}): FloatingIdea[] {
  const ideasHidden = useIdeasHidden()
  const lat = anchor?.lat
  const lng = anchor?.lng
  return useMemo(() => {
    if (
      !featureFlags.floatingIdeas ||
      ideasHidden ||
      !ready ||
      nowMs <= 0 ||
      lat == null ||
      lng == null
    ) {
      return NO_FLOATING
    }
    return placeFloatingIdeas({
      anchor: { lat, lng },
      ideas: getAnywhereIdeas({ now: new Date(nowMs), categories }),
      obstacles,
      radiusMeters,
    })
  }, [ideasHidden, ready, nowMs, lat, lng, categories, obstacles, radiusMeters])
}
