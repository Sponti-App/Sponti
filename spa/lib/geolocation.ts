"use client"

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
  accuracyMeters: number | null
  status: GeoStatus
  errorMessage: string | null
  request: () => void
  recenter: () => void
}

// SF Fillmore — used as a soft fallback so the map can render before we have
// permission. The UI must indicate this is *not* the user's real location.
export const FALLBACK_COORDS: GeoCoords = { lat: 37.7849, lng: -122.4344 }

export function useGeolocation(options?: {
  watch?: boolean
  autoRequest?: boolean
}): GeoState {
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null)
  const [status, setStatus] = useState<GeoStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
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

  return { coords, accuracyMeters, status, errorMessage, request, recenter }
}
