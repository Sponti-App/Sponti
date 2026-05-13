"use client"

// Single hook the UI consumes for the home screen. Falls back to the mock
// `events` seed when no API base URL is configured, so the prototype works
// offline. When `NEXT_PUBLIC_API_BASE_URL` is set, swaps to backend calls.
//
// Keep this file as the only adapter point — the rest of the app reads
// EventItem[] and is unaware of how it was sourced.

import { useEffect, useMemo, useState } from "react"
import { events as MOCK_EVENTS } from "./events"
import type { EventItem } from "./events"
import type { GeoCoords } from "./geolocation"
import { fetchCalendarEvents, fetchMapEvents } from "./api/events"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

// Small lat/lng deltas applied to mock events so they cluster near the user's
// real coordinates rather than appearing in SF for every tester. Real backend
// data uses absolute coordinates and bypasses this entirely.
//
// ≈ 111km/° at the equator, so 0.002° ≈ 220m. These offsets keep events within
// ~500m of the user, well inside the default map viewport.
const MOCK_OFFSETS: Array<{ dLat: number; dLng: number }> = [
  { dLat: 0.0025, dLng: 0.0015 },
  { dLat: -0.003, dLng: -0.0018 },
  { dLat: 0.001, dLng: -0.004 },
  { dLat: -0.0015, dLng: 0.0035 },
  { dLat: 0.004, dLng: -0.002 },
]

function repositionMockEvents(
  events: EventItem[],
  userCoords: GeoCoords | null,
): EventItem[] {
  if (!userCoords) return events
  return events.map((e, i) => {
    if (!e.location.coordinates) return e
    const o = MOCK_OFFSETS[i % MOCK_OFFSETS.length]
    return {
      ...e,
      location: {
        ...e.location,
        coordinates: [userCoords.lng + o.dLng, userCoords.lat + o.dLat],
      },
    }
  })
}

export type EventsState = {
  events: EventItem[]
  loading: boolean
  error: string | null
  refresh: () => void
}

function useApiEnabled() {
  return API_BASE.length > 0
}

// Demo-mode events used when the API is configured but unreachable (server
// down, not authenticated, network blocked). Lets the prototype keep working
// during backend outages instead of showing an empty map.
const DEMO_MAP_EVENTS = MOCK_EVENTS.filter((e) => !!e.location.coordinates)

export function useMapEvents(userCoords: GeoCoords | null, radiusKm = 25): EventsState {
  const apiEnabled = useApiEnabled()
  const [state, setState] = useState<EventsState>({
    events: apiEnabled ? [] : DEMO_MAP_EVENTS,
    loading: apiEnabled,
    error: null,
    refresh: () => {},
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!apiEnabled) return
    if (!userCoords) return
    const ac = new AbortController()
    // Defer the "loading: true" tick past the current render so it doesn't
    // trigger a cascading render synchronously inside the effect.
    queueMicrotask(() => {
      if (ac.signal.aborted) return
      setState((s) => ({ ...s, loading: true, error: null }))
    })
    fetchMapEvents({ ...userCoords, radiusKm, signal: ac.signal })
      .then((items) =>
        setState({
          events: items,
          loading: false,
          error: null,
          refresh: () => setTick((n) => n + 1),
        }),
      )
      .catch((err) => {
        if (ac.signal.aborted) return
        // API is configured but unreachable (server down, 401, network).
        // Fall back to demo events so the map UI keeps working — this is the
        // *prototype safety net*. Remove (or gate behind a NODE_ENV check)
        // when the backend is consistently available in your env.
        // eslint-disable-next-line no-console
        console.warn("[Sponti] map events fetch failed, using demo data:", err)
        setState({
          events: DEMO_MAP_EVENTS,
          loading: false,
          error: errMessage(err),
          refresh: () => setTick((n) => n + 1),
        })
      })
    return () => ac.abort()
  }, [apiEnabled, userCoords, radiusKm, tick])

  // In mock mode, anchor seed events to the user's real coords so they appear
  // near the user regardless of city. With real backend data this is a no-op.
  const events = useMemo(
    () => (apiEnabled ? state.events : repositionMockEvents(state.events, userCoords)),
    [apiEnabled, state.events, userCoords],
  )

  return {
    events,
    loading: state.loading,
    error: state.error,
    refresh: () => setTick((n) => n + 1),
  }
}

export function useCalendarEvents(): EventsState {
  const apiEnabled = useApiEnabled()
  const [state, setState] = useState<EventsState>({
    events: apiEnabled ? [] : MOCK_EVENTS,
    loading: apiEnabled,
    error: null,
    refresh: () => {},
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!apiEnabled) return
    const ac = new AbortController()
    queueMicrotask(() => {
      if (ac.signal.aborted) return
      setState((s) => ({ ...s, loading: true, error: null }))
    })
    fetchCalendarEvents({ limit: 100, signal: ac.signal })
      .then(({ items }) =>
        setState({
          events: items,
          loading: false,
          error: null,
          refresh: () => setTick((n) => n + 1),
        }),
      )
      .catch((err) => {
        if (ac.signal.aborted) return
        // Same prototype safety net as useMapEvents — fall back to demo data
        // so the calendar UI keeps working when the API is unreachable.
        // eslint-disable-next-line no-console
        console.warn("[Sponti] calendar events fetch failed, using demo data:", err)
        setState({
          events: MOCK_EVENTS,
          loading: false,
          error: errMessage(err),
          refresh: () => setTick((n) => n + 1),
        })
      })
    return () => ac.abort()
  }, [apiEnabled, tick])

  return {
    ...state,
    refresh: () => setTick((n) => n + 1),
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Failed to load events"
}
