"use client"

import { Capacitor } from "@capacitor/core"
import { useCallback, useEffect, useRef, useState } from "react"

export type GeoCoords = { lat: number; lng: number }

export type GeoStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
  | "error"

export type GeoState = {
  coords: GeoCoords | null
  lastKnownCoords: GeoCoords | null
  accuracyMeters: number | null
  status: GeoStatus
  errorMessage: string | null
  request: () => void
  recenter: () => void
}

const LAST_KNOWN_COORDS_KEY = "sponti.geo.last-known-coords.v1"

let memoryLastKnownCoords: GeoCoords | null | undefined

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

function isSecureGeolocationContext(): boolean {
  if (typeof window === "undefined") return false
  if (window.isSecureContext) return true
  if (Capacitor.isNativePlatform()) return true
  return isLoopbackHost(window.location.hostname)
}

function isValidCoords(value: unknown): value is GeoCoords {
  if (typeof value !== "object" || value === null) return false
  const coords = value as Partial<GeoCoords>
  return (
    typeof coords.lat === "number" &&
    Number.isFinite(coords.lat) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    typeof coords.lng === "number" &&
    Number.isFinite(coords.lng) &&
    coords.lng >= -180 &&
    coords.lng <= 180
  )
}

export function readLastKnownCoords(): GeoCoords | null {
  if (memoryLastKnownCoords !== undefined) return memoryLastKnownCoords
  if (typeof window === "undefined") {
    memoryLastKnownCoords = null
    return memoryLastKnownCoords
  }

  try {
    const raw = window.localStorage.getItem(LAST_KNOWN_COORDS_KEY)
    if (!raw) {
      memoryLastKnownCoords = null
      return memoryLastKnownCoords
    }
    const parsed = JSON.parse(raw) as unknown
    memoryLastKnownCoords = isValidCoords(parsed) ? parsed : null
  } catch {
    memoryLastKnownCoords = null
  }

  return memoryLastKnownCoords
}

function writeLastKnownCoords(coords: GeoCoords): void {
  memoryLastKnownCoords = coords
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LAST_KNOWN_COORDS_KEY, JSON.stringify(coords))
  } catch {
    // Best-effort cache only. The live geolocation result still works.
  }
}

// SF Fillmore remains only as a non-user-location demo coordinate for legacy
// callers. Product map surfaces should avoid rendering this as an intermediate
// user camera.
export const FALLBACK_COORDS: GeoCoords = { lat: 37.7849, lng: -122.4344 }

export function useGeolocation(options?: {
  watch?: boolean
  autoRequest?: boolean
}): GeoState {
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [lastKnownCoords, setLastKnownCoords] = useState<GeoCoords | null>(() =>
    readLastKnownCoords()
  )
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null)
  const [status, setStatus] = useState<GeoStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    setCoords(next)
    setLastKnownCoords(next)
    writeLastKnownCoords(next)
    setAccuracyMeters(pos.coords.accuracy)
    setStatus("granted")
    setErrorMessage(null)
  }, [])

  const handleError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus("denied")
      setErrorMessage("Location permission denied")
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setStatus("unavailable")
      setErrorMessage("Location unavailable")
    } else {
      setStatus("error")
      setErrorMessage(err.message || "Unable to determine location")
    }
  }, [])

  const request = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unavailable")
      setErrorMessage("Geolocation not supported")
      return
    }
    if (!isSecureGeolocationContext()) {
      setStatus("unavailable")
      setErrorMessage(
        "Location needs a secure connection. Open this app on localhost or HTTPS."
      )
      return
    }
    setStatus("requesting")
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    })
  }, [handleSuccess, handleError])

  const recenter = request

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return
    if (options?.autoRequest === false) return
    if (!isSecureGeolocationContext()) {
      setStatus("unavailable")
      setErrorMessage(
        "Location needs a secure connection. Open this app on localhost or HTTPS."
      )
      return
    }
    if (!options?.watch) {
      // Defer past the current render so the setStatus("requesting") inside
      // request() doesn't fire synchronously in the effect body.
      queueMicrotask(request)
      return
    }
    queueMicrotask(() => setStatus("requesting"))
    const id = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 15_000,
    })
    watchIdRef.current = id
    return () => {
      if (watchIdRef.current != null)
        navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [
    options?.autoRequest,
    options?.watch,
    request,
    handleSuccess,
    handleError,
  ])

  return {
    coords,
    lastKnownCoords,
    accuracyMeters,
    status,
    errorMessage,
    request,
    recenter,
  }
}
