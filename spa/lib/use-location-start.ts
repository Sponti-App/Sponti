"use client"

import { useCallback, useEffect, useState } from "react"
import { featureFlags } from "@/lib/feature-flags"
import {
  useGeolocation,
  type GeoCoords,
  type GeoState,
} from "@/lib/geolocation"
import {
  geoFailed,
  locationAskMode,
  locationAutoRequest,
  shouldRememberLocation,
  startCamera,
  type GeoPermission,
} from "@/lib/location-ask"
import {
  rememberLocationChoice,
  useLocationChoice,
  type StartArea,
} from "@/lib/location-choice"

// #408: where a map starts, and the location ask that decides it. Both home
// maps use it: the signed-in `MapView` and the signed-out `SignedOutMap`
// (through `SignedOutHome`). With `locationAsk` off it is a thin wrapper over
// `useGeolocation`, with today's camera and today's prompt on mount.

/** Asks the Permissions API once. Not watched afterwards: a change made while
 * the ask is open (or in another tab) never closes the sheet under the
 * person's thumb, and the next visit reads it fresh. */
function useGeoPermission(enabled: boolean): GeoPermission {
  const [permission, setPermission] = useState<GeoPermission>("unknown")
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const settle = (next: GeoPermission) => {
      if (!cancelled) setPermission(next)
    }
    const query = navigator.permissions?.query
    if (typeof query !== "function") {
      queueMicrotask(() => settle("prompt"))
      return () => {
        cancelled = true
      }
    }
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) =>
        settle(
          status.state === "granted" || status.state === "denied"
            ? status.state
            : "prompt"
        )
      )
      .catch(() => settle("prompt"))
    return () => {
      cancelled = true
    }
  }, [enabled])
  return permission
}

export type LocationStart = {
  geo: GeoState
  /** Where the camera starts; null while there is nowhere yet. */
  camera: GeoCoords | null
  /** Changes when a picked area moves the camera, for a map that only reads
   * its centre once (`defaultCenter`) to remount on. */
  cameraKey: string
  /** The camera is the last known position, not a live fix or a pick. */
  usingLastKnown: boolean
  /** The sheet: hidden, the ask, or the area picker. */
  mode: "hidden" | "ask" | "pick"
  /** The picked area the map shows, while there's no live position. */
  area: StartArea | null
  /** "use my location" was tapped and the browser hasn't answered yet. */
  requesting: boolean
  /** "use my location" was tapped and it failed (denied or blocked). */
  blocked: boolean
  requestLocation: () => void
  pickArea: (area: StartArea) => void
}

export function useLocationStart({
  fallback,
  useLastKnown,
  alwaysFallback,
  requestByDefault,
  hold = false,
}: {
  /** Where the map sits behind the ask (and, with `alwaysFallback`, until
   * there's a position or a pick). */
  fallback: GeoCoords
  /** Start on the last known position before a fix arrives. */
  useLastKnown: boolean
  alwaysFallback: boolean
  /** Flag off: whether the map asks the browser on mount (today's
   * behaviour: the signed-in map does, the signed-out map doesn't). */
  requestByDefault: boolean
  /** Keep the sheet away for now (the intro slides, a sheet on top). */
  hold?: boolean
}): LocationStart {
  const enabled = featureFlags.locationAsk
  const choice = useLocationChoice()
  const permission = useGeoPermission(enabled)
  const [requested, setRequested] = useState(false)

  const geo = useGeolocation({
    autoRequest: locationAutoRequest({
      enabled,
      choice,
      permission,
      byDefault: requestByDefault,
    }),
  })

  const mode = locationAskMode({
    enabled,
    choice,
    permission,
    requested,
    geoStatus: geo.status,
  })

  const remember = shouldRememberLocation({
    enabled,
    choice,
    geoStatus: geo.status,
  })
  useEffect(() => {
    if (remember) rememberLocationChoice({ kind: "location" })
  }, [remember])

  const camera = startCamera({
    enabled,
    choice,
    coords: geo.coords,
    lastKnown: geo.lastKnownCoords,
    useLastKnown,
    asking: mode !== "hidden",
    fallback,
    alwaysFallback,
  })

  const { request } = geo
  const requestLocation = useCallback(() => {
    setRequested(true)
    request()
  }, [request])
  const pickArea = useCallback((area: StartArea) => {
    // The ask's denial is done with: the banner's blocked help only shows
    // after its own "use my location" fails.
    setRequested(false)
    rememberLocationChoice({ kind: "area", area })
  }, [])

  const area =
    enabled && choice?.kind === "area" && !geo.coords ? choice.area : null

  return {
    geo,
    camera,
    cameraKey: area ? `area:${area.id}` : "here",
    usingLastKnown:
      camera != null && geo.coords == null && camera === geo.lastKnownCoords,
    mode: hold ? "hidden" : mode,
    area,
    requesting: requested && geo.status === "requesting",
    blocked: requested && geoFailed(geo.status),
    requestLocation,
    pickArea,
  }
}
