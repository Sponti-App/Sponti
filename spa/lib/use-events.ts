"use client"

// Single hook the UI consumes for the home screen. Events come from the api,
// or from bundled demo data when the `seedDemoData` flag is on. The two never
// mix: a failed or unconfigured api shows an error state, never demo flares,
// so testers can't mistake made-up events for real ones.
//
// Keep this file as the only fetching decision point. The rest of the app reads
// EventItem[] and is unaware of how it was sourced.

import { useEffect, useMemo, useState } from "react"
import type { GeoCoords } from "./geolocation"
import {
  DEMO_MAP_EVENTS,
  MOCK_EVENTS,
  fetchCalendarEvents,
  fetchMyFlares,
  fetchMapEvents,
  repositionMockEvents,
  type EventsState,
  type MyFlaresState,
} from "./api/events"
import { featureFlags } from "./feature-flags"
import { resolveConfiguredBaseUrl } from "./http"

const API_BASE = resolveConfiguredBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
)
type EventsChangedListener = () => void

// Avoids duplicates, easy add and remove.
const eventsChangedListeners = new Set<EventsChangedListener>()

export function emitEventsChanged(): void {
  for (const listener of eventsChangedListeners) {
    listener()
  }
}

export function subscribeToEventsChanged(
  listener: EventsChangedListener
): () => void {
  eventsChangedListeners.add(listener)
  return () => {
    eventsChangedListeners.delete(listener)
  }
}

const DEMO_MODE = featureFlags.seedDemoData

// Shown instead of fetching when the build has no api URL and demo data is off.
export const API_NOT_CONFIGURED_ERROR = "Backend API is not configured"

function apiConfigured(): boolean {
  return API_BASE.length > 0
}

const MAP_EVENTS_STALE_MS = 60_000

type MapEventsCacheEntry = {
  events: EventsState["events"]
  fetchedAt: number
}

type MapEventsState = Omit<EventsState, "refresh"> & {
  cacheKey: string | null
}

const mapEventsCache = new Map<string, MapEventsCacheEntry>()

function coordinateCachePart(value: number): string {
  return value.toFixed(3)
}

function mapEventsCacheKey(coords: GeoCoords, radiusKm: number): string {
  return [
    coordinateCachePart(coords.lat),
    coordinateCachePart(coords.lng),
    radiusKm,
  ].join(":")
}

export function useMapEvents(
  userCoords: GeoCoords | null,
  radiusKm = 25
): EventsState {
  const queryKey = useMemo(
    () => (userCoords ? mapEventsCacheKey(userCoords, radiusKm) : null),
    [userCoords, radiusKm]
  )
  const [state, setState] = useState<MapEventsState>({
    events: DEMO_MODE ? DEMO_MAP_EVENTS : [],
    loading: false,
    refreshing: false,
    error: DEMO_MODE || apiConfigured() ? null : API_NOT_CONFIGURED_ERROR,
    cacheKey: null,
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (DEMO_MODE || !apiConfigured()) return
    return subscribeToEventsChanged(() => setTick((n) => n + 1))
  }, [])

  useEffect(() => {
    if (DEMO_MODE || !apiConfigured()) return
    let cancelled = false

    if (!userCoords || !queryKey) {
      queueMicrotask(() => {
        if (cancelled) return
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error: null,
          cacheKey: null,
        }))
      })
      return () => {
        cancelled = true
      }
    }

    const cached = mapEventsCache.get(queryKey)
    const cachedIsFresh =
      cached != null && Date.now() - cached.fetchedAt < MAP_EVENTS_STALE_MS
    const shouldFetch = !cached || !cachedIsFresh || tick > 0

    queueMicrotask(() => {
      if (cancelled) return
      setState((current) => {
        const sameQuery = current.cacheKey === queryKey
        const events = cached?.events ?? (sameQuery ? current.events : [])
        const hasEvents = events.length > 0
        return {
          events,
          loading: shouldFetch && !hasEvents,
          refreshing: shouldFetch && hasEvents,
          error: null,
          cacheKey: queryKey,
        }
      })
    })

    if (!shouldFetch)
      return () => {
        cancelled = true
      }

    const ac = new AbortController()
    fetchMapEvents({ ...userCoords, radiusKm, signal: ac.signal })
      .then((items) => {
        if (cancelled) return
        mapEventsCache.set(queryKey, { events: items, fetchedAt: Date.now() })
        setState({
          events: items,
          loading: false,
          refreshing: false,
          error: null,
          cacheKey: queryKey,
        })
      })
      .catch((err) => {
        if (cancelled) return
        if (ac.signal.aborted) return
        console.warn("[Sponti] map events fetch failed:", err)
        setState((current) => {
          // Keep the last real result on screen for this query; otherwise
          // show nothing and let the UI render the error state.
          const keepExisting =
            current.cacheKey === queryKey && current.events.length > 0
          return {
            events: keepExisting ? current.events : [],
            loading: false,
            refreshing: false,
            error: errMessage(err),
            cacheKey: queryKey,
          }
        })
      })
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [userCoords, radiusKm, queryKey, tick])

  // In demo mode, anchor seed events to the user's real coords so they appear
  // near the user regardless of city. With real backend data this is a no-op.
  const events = useMemo(
    () =>
      DEMO_MODE ? repositionMockEvents(state.events, userCoords) : state.events,
    [state.events, userCoords]
  )

  return {
    events,
    loading: state.loading,
    refreshing: state.refreshing,
    error: state.error,
    refresh: () => setTick((n) => n + 1),
  }
}

export function useCalendarEvents(): EventsState {
  const fetchesFromApi = !DEMO_MODE && apiConfigured()
  const [state, setState] = useState<EventsState>({
    events: DEMO_MODE ? MOCK_EVENTS : [],
    loading: fetchesFromApi,
    error: DEMO_MODE || fetchesFromApi ? null : API_NOT_CONFIGURED_ERROR,
    refresh: () => {},
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!fetchesFromApi) return
    return subscribeToEventsChanged(() => setTick((n) => n + 1))
  }, [fetchesFromApi])

  useEffect(() => {
    if (!fetchesFromApi) return
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
        })
      )
      .catch((err) => {
        if (ac.signal.aborted) return
        console.warn("[Sponti] calendar events fetch failed:", err)
        // Keep the last real result if there is one; never swap in demo data.
        setState((s) => ({
          ...s,
          loading: false,
          error: errMessage(err),
          refresh: () => setTick((n) => n + 1),
        }))
      })
    return () => ac.abort()
  }, [fetchesFromApi, tick])

  return {
    ...state,
    refresh: () => setTick((n) => n + 1),
  }
}

/**
 * Loads the authenticated user's dashboard flares from the backend, split into
 * hosted, invited, and recent past-hosted buckets.
 */
export function useMyFlares(): MyFlaresState {
  const apiEnabled = apiConfigured()
  const [state, setState] = useState<MyFlaresState>({
    hostedByMe: [],
    invited: [],
    pastHosted: [],
    loading: apiEnabled,
    // TODO(demo-mode): Unlike map/calendar, this dashboard intentionally does
    // not fall back to the old hosted localStorage store because host actions
    // now have backend side effects: cancel/reactivate notifications, member
    // counts, and server-side host authorization. If we need offline demos
    // later, add a separate mock-only fixture here instead of resurrecting
    // localStorage as a source of truth.
    error: apiEnabled ? null : API_NOT_CONFIGURED_ERROR,
    refresh: () => {},
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!apiEnabled) return
    return subscribeToEventsChanged(() => setTick((n) => n + 1))
  }, [apiEnabled])

  useEffect(() => {
    if (!apiEnabled) return
    const ac = new AbortController()

    queueMicrotask(() => {
      if (ac.signal.aborted) return
      setState((s) => ({ ...s, loading: true, error: null }))
    })

    fetchMyFlares(ac.signal)
      .then((result) =>
        setState({
          ...result,
          loading: false,
          error: null,
          refresh: () => setTick((n) => n + 1),
        })
      )
      .catch((err) => {
        if (ac.signal.aborted) return
        setState((s) => ({
          ...s,
          loading: false,
          error: errMessage(err),
          refresh: () => setTick((n) => n + 1),
        }))
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
