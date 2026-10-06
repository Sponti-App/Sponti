"use client"

import { useEffect, useState } from "react"
import {
  PUBLIC_MAP_DEFAULT_RADIUS_KM,
  fetchPublicMapPins,
  type PublicMapPin,
} from "@/lib/api/public-map"
import type { GeoCoords } from "@/lib/geolocation"

export type PublicMapPinsState = {
  pins: PublicMapPin[]
  loading: boolean
  /** The last load failed; the map shows no pins rather than stale ones. */
  failed: boolean
}

/**
 * The signed-out map's open-to-all pins around `center` (#389). Loads once
 * per centre and radius. It is the only flare data a signed-out visitor
 * loads, through the one public endpoint, so it never reaches for a session.
 */
export function usePublicMapPins(
  center: GeoCoords,
  radiusKm: number = PUBLIC_MAP_DEFAULT_RADIUS_KM
): PublicMapPinsState {
  const { lat, lng } = center
  const [state, setState] = useState<PublicMapPinsState>({
    pins: [],
    loading: true,
    failed: false,
  })

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      setState((current) => ({ ...current, loading: true }))
    })
    fetchPublicMapPins({ lat, lng }, radiusKm, controller.signal)
      .then((pins) => {
        if (controller.signal.aborted) return
        setState({ pins, loading: false, failed: false })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setState({ pins: [], loading: false, failed: true })
      })
    return () => controller.abort()
  }, [lat, lng, radiusKm])

  return state
}
