"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
  APILoadingStatus,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps"
import { Card } from "@/components/ui/card"
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Check,
  Flame,
  LocateFixed,
  MapPin,
  AlertCircle,
  Calendar as CalendarIcon,
  Expand,
  X,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  avatarText,
  distanceFromUser,
  eventCoords,
  EventType,
  formatRelativeStatus,
  isJoined,
  isLive,
  type EventItem,
} from "@/lib/api/events"
import {
  useGeolocation,
  type GeoCoords,
  type GeoStatus,
} from "@/lib/geolocation"
import { useMapEvents } from "@/lib/use-events"
import { haptic } from "@/lib/haptics"
import { useNewEventDrawer } from "@/components/new-event-drawer-provider"
import { computeRoute, type RouteResult } from "@/lib/routes-api"
import { EVENT_TYPES } from "@/types/utils"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"

// Hex equivalent of --accent (oklch 0.55 0.19 25). Google Maps overlays can't
// read CSS variables, so we mirror the token here. Keep in sync with globals.css.
const ACCENT_HEX = "#c44040"

function GoogleMapPolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
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

function FitBoundsOnce({
  origin,
  destination,
}: {
  origin: GeoCoords | null
  destination: GeoCoords | null
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
    map.fitBounds(bounds, 80)
  }, [map, origin, destination])
  return null
}

function eventIcon(type: EventType, avatar: string) {
  const match = EVENT_TYPES.find((t) => t.value === type)

  if (!match) {
    return <>{avatar}</>
  }

  const Icon = match.icon

  return <Icon className="h-5 w-5 shrink-0 text-accent-foreground" />
}

function StaticMapFallback({
  events,
  onEventSelect,
  joinedIds,
  user,
}: {
  events: EventItem[]
  onEventSelect: (event: EventItem) => void
  joinedIds: Set<string>
  user: GeoCoords
}) {
  return (
    <div className="relative h-full w-full bg-muted">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
      </div>
      {events.slice(0, 4).map((event, i) => {
        // Pseudo positions around the center so the static fallback is readable
        const positions = [
          { top: "30%", left: "26%" },
          { top: "55%", right: "14%" },
          { top: "68%", left: "32%" },
          { top: "22%", right: "22%" },
        ]
        const pos = positions[i % positions.length]
        const dist = distanceFromUser(event, user)?.label ?? ""
        return (
          <button
            key={event.id}
            onClick={() => onEventSelect(event)}
            style={pos}
            className="absolute flex cursor-pointer flex-col items-center"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium shadow-lg ${event.host.color} ${avatarText(event.host.color)} ${
                isJoined(event, joinedIds)
                  ? "ring-2 ring-accent ring-offset-2"
                  : ""
              }`}
            >
              {eventIcon(event.type, event.host.avatar)}
            </div>
            <div className="mt-1 rounded bg-card px-2 py-1 text-center text-xs shadow-md">
              <span className="font-medium">{event.title.split("·", 2)}</span>
              {dist && (
                <>
                  <br />
                  <span className="text-muted-foreground">{dist}</span>
                </>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function GoogleMapContent({
  events,
  onEventSelect,
  routeResult,
  routeDestination,
  joinedIds,
  cameraCenter,
  currentLocation,
  recenterTick,
}: {
  events: EventItem[]
  onEventSelect: (event: EventItem) => void
  routeResult: RouteResult | null
  routeDestination: GeoCoords | null
  joinedIds: Set<string>
  cameraCenter: GeoCoords
  currentLocation: GeoCoords | null
  recenterTick: number
}) {
  const status = useApiLoadingStatus()
  const map = useMap()
  const { resolvedTheme } = useTheme()
  const autoCenteredRef = useRef(false)
  const colorScheme = resolvedTheme === "dark" ? "DARK" : "LIGHT"
  const userInteractedRef = useRef(false)

  // If the map opened from a cached camera, move to fresh GPS once it arrives,
  // but only while the user has not started navigating the map themselves.
  useEffect(() => {
    if (
      !map ||
      autoCenteredRef.current ||
      !currentLocation ||
      userInteractedRef.current
    )
      return
    autoCenteredRef.current = true
    map.panTo(currentLocation)
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
  }, [map, currentLocation])

  // Recenter on explicit user action
  useEffect(() => {
    if (!map || recenterTick === 0 || !currentLocation) return
    userInteractedRef.current = false
    map.panTo(currentLocation)
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
  }, [map, currentLocation, recenterTick])

  if (status === APILoadingStatus.FAILED) {
    return (
      <StaticMapFallback
        events={events}
        onEventSelect={onEventSelect}
        joinedIds={joinedIds}
        user={cameraCenter}
      />
    )
  }

  return (
    <Map
      defaultCenter={cameraCenter}
      defaultZoom={15}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      colorScheme={colorScheme}
      reuseMaps
      disableDefaultUI
      gestureHandling="greedy"
      className="h-full w-full"
      onDragstart={() => {
        userInteractedRef.current = true
      }}
      onCameraChanged={(event) => {
        if (event.domEvent) userInteractedRef.current = true
      }}
    >
      {currentLocation && (
        <AdvancedMarker position={currentLocation}>
          <div className="h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
        </AdvancedMarker>
      )}
      {events.map((event) => {
        const coords = eventCoords(event)
        if (!coords) return null
        return (
          <AdvancedMarker
            key={event.id}
            position={coords}
            onClick={() => onEventSelect(event)}
          >
            <div className="flex cursor-pointer flex-col items-center">
              <div className="relative flex items-center justify-center">
                {isLive(event) && (
                  <span
                    aria-hidden="true"
                    className="animate-pulse-ring absolute h-8 w-8 rounded-full bg-accent"
                  />
                )}
                <div
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium shadow-lg ${event.host.color} ${avatarText(event.host.color)} ${
                    isJoined(event, joinedIds)
                      ? "ring-2 ring-accent ring-offset-2"
                      : ""
                  }`}
                >
                  {eventIcon(event.type, event.host.avatar)}
                </div>
              </div>
              {isLive(event) && (
                <div className="mt-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground shadow">
                  live
                </div>
              )}
            </div>
          </AdvancedMarker>
        )
      })}
      {routeResult && <GoogleMapPolyline path={routeResult.path} />}
      {routeDestination && (
        <FitBoundsOnce
          origin={currentLocation ?? cameraCenter}
          destination={routeDestination}
        />
      )}
    </Map>
  )
}

type PeekState = "mini" | "peek" | "expanded"

// Fixed pixel heights for mini and peek states
const SHEET_PX = { mini: 64, peek: 268 } as const

// The collapsed sheet and FAB sit above the BottomNav. BottomNav writes its
// actual rendered height (incl. safe-area inset) to --sponti-nav-h so we get
// a pixel-perfect anchor on every device. Fallback covers the first paint
// before the ResizeObserver fires.
const NAV_RESERVED_CSS = "var(--sponti-nav-h, 64px)"

// One-shot dev warning: AdvancedMarker silently renders nothing when the map
// has no mapId. Surfacing this early saves a debugging session.
let warnedNoMapId = false
function warnIfMissingMapId(
  apiKey: string | undefined,
  mapId: string | undefined
): void {
  if (warnedNoMapId) return
  if (apiKey && !mapId && process.env.NODE_ENV !== "production") {
    warnedNoMapId = true
    // eslint-disable-next-line no-console
    console.warn(
      "[Sponti] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set but NEXT_PUBLIC_GOOGLE_MAPS_ID is not — AdvancedMarker will render blank. Add a Map ID in the Google Cloud console."
    )
  }
}

// Default + widened radii for the empty-state pivot. If 10 km nearby is empty,
// the user can opt into 20 km. Beyond that, we suggest the calendar view.
const DEFAULT_RADIUS_KM = 10
const WIDE_RADIUS_KM = 20

export function MapView({
  onEventSelect,
  activeRoute,
  joinedIds,
  onRouteReady,
  onSeeCalendar,
}: {
  onEventSelect: (event: EventItem) => void
  activeRoute: EventItem | null
  joinedIds: Set<string>
  onRouteReady?: (event: EventItem, etaLabel: string) => void
  onSeeCalendar?: () => void
}) {
  const { openDrawer } = useNewEventDrawer()
  const router = useRouter()
  const [peekState, setPeekState] = useState<PeekState>("peek")
  const dragStartY = useRef<number | null>(null)
  const dragStartTime = useRef<number | null>(null)

  // Long-press on the map canvas → open flare creation drawer.
  // 500 ms is the standard long-press threshold on mobile.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return // let map controls handle their own events
    longPressTimer.current = setTimeout(() => {
      haptic("medium")
      openDrawer()
      longPressTimer.current = null
    }, 500)
  }
  const handleMapPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID
  warnIfMissingMapId(apiKey, mapId)
  const [recenterTick, setRecenterTick] = useState(0)

  const geo = useGeolocation()
  const cameraCenter = geo.coords ?? geo.lastKnownCoords
  const hasCurrentLocation = geo.coords != null
  const isUsingCachedLocation =
    !hasCurrentLocation && geo.lastKnownCoords != null
  // The recenter button only makes sense on a real interactive map.
  const hasInteractiveMap = !!apiKey && cameraCenter != null

  const [searchRadiusKm, setSearchRadiusKm] = useState(DEFAULT_RADIUS_KM)
  const [typeFilters, setTypeFilters] = useState<Set<EventType>>(new Set())
  const [timeFilter, setTimeFilter] = useState<"live" | "upcoming" | "all">(
    "all"
  )
  const [showEnded, setShowEnded] = useState(false)
  const map = useMapEvents(cameraCenter, searchRadiusKm)
  const mapEvents = useMemo(
    () => map.events.filter((e) => !!e.location.coordinates),
    [map.events]
  )
  const groupedEvents = useMemo(() => {
    const now = Date.now()
    const live: EventItem[] = []
    const upcoming: EventItem[] = []
    const ended: EventItem[] = []
    for (const e of mapEvents) {
      if (typeFilters.size > 0 && !typeFilters.has(e.type)) continue
      const start = new Date(e.startAt).getTime()
      const end = new Date(e.endAt).getTime()
      if (now >= start && now <= end) live.push(e)
      else if (start > now) upcoming.push(e)
      else ended.push(e)
    }
    // Live ends soonest first, upcoming starts soonest first, ended most-recent first.
    live.sort(
      (a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
    )
    upcoming.sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )
    ended.sort(
      (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
    )
    return { live, upcoming, ended }
  }, [mapEvents, typeFilters])
  const visibleEvents = useMemo(() => {
    if (timeFilter === "live") return groupedEvents.live
    if (timeFilter === "upcoming") return groupedEvents.upcoming
    return [...groupedEvents.live, ...groupedEvents.upcoming]
  }, [groupedEvents, timeFilter])
  const activeCount =
    groupedEvents.live.length + groupedEvents.upcoming.length
  const endedVisible =
    timeFilter === "all" && groupedEvents.ended.length > 0

  // ---- Routes API: compute route + ETA when activeRoute changes ----
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const routeDestination = useMemo<GeoCoords | null>(
    () => (activeRoute ? eventCoords(activeRoute) : null),
    [activeRoute]
  )
  const routeOrigin = geo.coords ?? cameraCenter
  const onRouteReadyRef = useRef(onRouteReady)

  useEffect(() => {
    onRouteReadyRef.current = onRouteReady
  }, [onRouteReady])

  useEffect(() => {
    if (!activeRoute || !routeDestination || !routeOrigin) {
      queueMicrotask(() => {
        setRouteResult(null)
        setRouteError(null)
      })
      return
    }
    if (!apiKey) {
      // Without an API key we can't call Routes API; degrade to a straight
      // line and skip the ETA. Map is in static-fallback mode anyway.
      queueMicrotask(() =>
        setRouteResult({
          path: [routeOrigin, routeDestination],
          durationSeconds: 0,
          distanceMeters: 0,
          etaLabel: "",
          distanceLabel: "",
        })
      )
      return
    }
    const ac = new AbortController()
    computeRoute(routeOrigin, routeDestination, "WALK", ac.signal)
      .then((result) => {
        setRouteResult(result)
        setRouteError(null)
        if (result.etaLabel)
          onRouteReadyRef.current?.(activeRoute, result.etaLabel)
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        // Fall back to a straight line so the user still has *some* visual
        const fallback: RouteResult = {
          path: [routeOrigin, routeDestination],
          durationSeconds: 0,
          distanceMeters: 0,
          etaLabel: "",
          distanceLabel: "",
        }
        setRouteResult(fallback)
        setRouteError(err instanceof Error ? err.message : "Route unavailable")
      })
    return () => ac.abort()
  }, [activeRoute, routeDestination, routeOrigin, apiKey])

  // Pull-to-refresh on the sheet list. Fires only when the scroll container is
  // at the top (scrollTop === 0) and the user drags down more than 56px.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullStartY = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) === 0) {
      pullStartY.current = e.touches[0].clientY
    }
  }
  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    if (pullStartY.current === null) return
    const dist = e.changedTouches[0].clientY - pullStartY.current
    pullStartY.current = null
    if (dist < 56) return
    setIsRefreshing(true)
    haptic("light")
    map.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  // Velocity-aware snap: a fast flick overrides the distance threshold.
  // Velocity is measured in px/ms; anything above 0.4 is considered a throw.
  const FLICK_VX = 0.4
  const DELTA_PX = 50

  const snap = useCallback(
    (next: PeekState) => {
      if (next === peekState) return
      setPeekState(next)
      haptic("selection")
    },
    [peekState]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY
    dragStartTime.current = performance.now()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || dragStartTime.current === null) return
    const delta = e.clientY - dragStartY.current
    const elapsed = performance.now() - dragStartTime.current
    const velocity = Math.abs(delta) / Math.max(elapsed, 1)
    dragStartY.current = null
    dragStartTime.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    const isFlick = velocity > FLICK_VX
    const goDown = delta > DELTA_PX || (isFlick && delta > 0)
    const goUp = delta < -DELTA_PX || (isFlick && delta < 0)
    if (goDown) {
      if (peekState === "expanded") snap("peek")
      else if (peekState === "peek") snap("mini")
    } else if (goUp) {
      if (peekState === "mini") snap("peek")
      else if (peekState === "peek") snap("expanded")
    }
  }

  // The "expanded" state keeps a strip of the map visible at the top instead
  // of going full-screen, mirroring the new-event drawer behaviour. 80vh
  // leaves room for the route pill and floating header chips above it.
  const sheetStyle: React.CSSProperties =
    peekState === "expanded"
      ? { height: "80vh", bottom: 0 }
      : peekState === "mini"
        ? { height: `${SHEET_PX.mini}px`, bottom: NAV_RESERVED_CSS }
        : { height: `${SHEET_PX.peek}px`, bottom: 0 }

  const fabBottomStyle: React.CSSProperties =
    peekState === "mini"
      ? { bottom: `calc(${NAV_RESERVED_CSS} + ${SHEET_PX.mini + 12}px)` }
      : { bottom: `${SHEET_PX.peek + 12}px` }
  // Recenter sits above the primary flare FAB. 56 = 44 (recenter) + 12 gap.
  const recenterBottomStyle: React.CSSProperties =
    peekState === "mini"
      ? { bottom: `calc(${NAV_RESERVED_CSS} + ${SHEET_PX.mini + 12 + 68}px)` }
      : { bottom: `${SHEET_PX.peek + 12 + 68}px` }

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onPointerDown={handleMapPointerDown}
      onPointerUp={handleMapPointerUp}
      onPointerCancel={handleMapPointerUp}
      onPointerLeave={handleMapPointerUp}
    >
      {!cameraCenter ? (
        <MapCameraPlaceholder
          status={geo.status}
          errorMessage={geo.errorMessage}
          onRetry={geo.request}
        />
      ) : apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMapContent
            events={mapEvents}
            onEventSelect={onEventSelect}
            routeResult={routeResult}
            routeDestination={routeDestination}
            joinedIds={joinedIds}
            cameraCenter={cameraCenter}
            currentLocation={geo.coords}
            recenterTick={recenterTick}
          />
        </APIProvider>
      ) : (
        <StaticMapFallback
          events={mapEvents}
          onEventSelect={onEventSelect}
          joinedIds={joinedIds}
          user={cameraCenter}
        />
      )}

      {/* Geolocation + route error banners — top-16 clears the floating header chips */}
      <GeolocationBanner
        status={geo.status}
        showingCachedLocation={isUsingCachedLocation}
        onRetry={geo.request}
      />

      {routeError && (
        <div className="absolute top-28 right-3 z-30 flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs shadow">
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span>Route unavailable</span>
        </div>
      )}

      {/* Primary FAB: light a flare. Sits in the natural thumb-reach spot,
          above the bottom sheet. Recenter sits above it as a utility. */}
      <button
        type="button"
        onClick={() => {
          haptic("medium")
          openDrawer()
        }}
        style={fabBottomStyle}
        aria-label="Light a flare"
        className="absolute right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-[bottom] duration-300 ease-out active:scale-95"
      >
        <Flame className="h-6 w-6" />
      </button>

      {/* Recenter button — only meaningful on a real Google map; hidden in the
          static fallback where pan/zoom and panTo don't apply. */}
      {hasInteractiveMap && (
        <button
          type="button"
          onClick={() => {
            haptic("light")
            if (!hasCurrentLocation) geo.request()
            else setRecenterTick((n) => n + 1)
          }}
          style={recenterBottomStyle}
          aria-label="Recenter on my location"
          className="absolute right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-[bottom] duration-300 ease-out"
        >
          <LocateFixed className="h-5 w-5" />
        </button>
      )}

      {/* Bottom sheet — z-50 when expanded so it covers the nav pill */}
      <div
        style={sheetStyle}
        className={`absolute right-0 left-0 rounded-t-3xl bg-background shadow-(--shadow-sheet) transition-all duration-300 ease-out ${
          peekState === "expanded" ? "z-50" : "z-20"
        }`}
      >
        <div
          className="flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {peekState === "mini" ? (
          <button
            onClick={() => setPeekState("peek")}
            aria-label="Expand flares sheet"
            className="flex h-[calc(100%-44px)] w-full items-center justify-center gap-2 px-4 text-sm font-medium text-muted-foreground active:bg-muted/40"
          >
            <ChevronUp className="h-5 w-5" />
            {sheetSummary(
              map.loading,
              Boolean(map.refreshing),
              mapEvents.length,
              map.error,
              !cameraCenter
            )}
          </button>
        ) : (
          <div
            ref={scrollRef}
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
            className={`h-[calc(100%-44px)] overflow-y-auto px-4 ${
              peekState === "expanded" ? "pb-8" : "pb-24"
            }`}
          >
            {/* Pull-to-refresh indicator */}
            {isRefreshing && (
              <div className="mb-2 flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                refreshing…
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">flares near you</h2>
              <span className="text-xs text-muted-foreground">
                {!cameraCenter
                  ? locationStatusLabel(geo.status)
                  : map.loading
                    ? "loading..."
                    : map.refreshing
                      ? "updating..."
                      : `${activeCount} active`}
              </span>
            </div>

            {/* Time-range segmented control + type chips. Both hidden when
                there are no events nearby (nothing to filter). */}
            {cameraCenter && mapEvents.length > 0 && (
              <div className="mb-3 space-y-2">
                <Tabs
                  value={timeFilter}
                  onValueChange={(v) => {
                    haptic("selection")
                    setTimeFilter(v as "live" | "upcoming" | "all")
                  }}
                >
                  <TabsList className="h-8 w-full">
                    <TabsTrigger value="live" className="text-xs">
                      live
                    </TabsTrigger>
                    <TabsTrigger value="upcoming" className="text-xs">
                      upcoming
                    </TabsTrigger>
                    <TabsTrigger value="all" className="text-xs">
                      all
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
                  {EVENT_TYPES.map((t) => (
                    <FilterChip
                      key={t.value}
                      label={t.label}
                      icon={t.icon}
                      active={typeFilters.has(t.value)}
                      onClick={() => {
                        haptic("selection")
                        setTypeFilters((prev) => {
                          const next = new Set(prev)
                          if (next.has(t.value)) next.delete(t.value)
                          else next.add(t.value)
                          return next
                        })
                      }}
                    />
                  ))}
                  {typeFilters.size > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        haptic("selection")
                        setTypeFilters(new Set())
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                      clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {!cameraCenter ? (
              <LocationSheetState
                status={geo.status}
                errorMessage={geo.errorMessage}
                onRetry={geo.request}
              />
            ) : map.error && mapEvents.length === 0 ? (
              <ErrorPanel message={map.error} onRetry={map.refresh} />
            ) : visibleEvents.length === 0 &&
              !endedVisible &&
              !map.loading ? (
              <EmptyState
                radiusKm={searchRadiusKm}
                onWiden={
                  searchRadiusKm < WIDE_RADIUS_KM
                    ? () => setSearchRadiusKm(WIDE_RADIUS_KM)
                    : null
                }
                onSeeCalendar={onSeeCalendar}
                onFindConnections={() => router.push("/circles?tab=people")}
              />
            ) : (
              <div className="space-y-2">
                {map.refreshing && mapEvents.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    loading nearby events...
                  </div>
                )}
                {map.error && mapEvents.length > 0 && (
                  <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                    couldn&apos;t refresh nearby flares
                  </div>
                )}
                {visibleEvents.map((event) => (
                  <FlareCard
                    key={event.id}
                    event={event}
                    joined={isJoined(event, joinedIds)}
                    user={geo.coords}
                    status={isLive(event) ? "live" : "upcoming"}
                    onClick={() => onEventSelect(event)}
                    onSwipeJoin={() => {
                      haptic("success")
                      onEventSelect(event)
                    }}
                  />
                ))}
                {endedVisible && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        haptic("selection")
                        setShowEnded((s) => !s)
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span>
                        {showEnded ? "hide" : "show"}{" "}
                        {groupedEvents.ended.length} ended
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          showEnded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {showEnded &&
                      groupedEvents.ended.map((event) => (
                        <FlareCard
                          key={event.id}
                          event={event}
                          joined={isJoined(event, joinedIds)}
                          user={geo.coords}
                          status="ended"
                          onClick={() => onEventSelect(event)}
                        />
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MapCameraPlaceholder({
  status,
  errorMessage,
  onRetry,
}: {
  status: GeoStatus
  errorMessage: string | null
  onRetry: () => void
}) {
  const blocked =
    status === "denied" || status === "unavailable" || status === "error"
  const title = blocked ? "location needed" : "finding your location"
  const message = blocked
    ? (errorMessage ??
      "Turn on location access to show nearby flares in your area.")
    : "Setting up the map around you."

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-muted">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-6 flex max-w-xs flex-col items-center text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-sm">
          {blocked ? (
            <MapPin className="h-5 w-5 text-accent" />
          ) : (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          )}
        </div>
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {blocked && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            try again
          </button>
        )}
      </div>
    </div>
  )
}

function GeolocationBanner({
  status,
  showingCachedLocation,
  onRetry,
}: {
  status: GeoStatus
  showingCachedLocation: boolean
  onRetry: () => void
}) {
  if (!showingCachedLocation) return null
  if (status === "granted" || status === "idle" || status === "requesting")
    return null
  const msg =
    status === "denied"
      ? "showing last known area - enable location for nearby flares"
      : "couldn't update your location - showing last known area"
  return (
    <div className="absolute top-16 right-3 left-3 z-30 flex items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 text-xs shadow-md">
      <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span className="flex-1">{msg}</span>
      <button onClick={onRetry} className="shrink-0 font-medium text-accent">
        retry
      </button>
    </div>
  )
}

function locationStatusLabel(status: GeoStatus): string {
  if (status === "denied") return "location off"
  if (status === "unavailable" || status === "error") return "location issue"
  return "locating..."
}

function LocationSheetState({
  status,
  errorMessage,
  onRetry,
}: {
  status: GeoStatus
  errorMessage: string | null
  onRetry: () => void
}) {
  const blocked =
    status === "denied" || status === "unavailable" || status === "error"

  if (!blocked) {
    return (
      <div className="rounded-xl border border-border p-4 text-center">
        <span className="mx-auto mb-3 block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm font-medium">finding your location</p>
        <p className="mt-1 text-xs text-muted-foreground">
          nearby flares will load once the map knows where to start
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border p-4 text-center">
      <MapPin className="mx-auto mb-2 h-5 w-5 text-accent" />
      <p className="text-sm font-medium">location needed</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {errorMessage ??
          "Enable location access to show nearby flares around you."}
      </p>
      <button
        onClick={onRetry}
        className="mt-3 text-sm font-medium text-accent"
      >
        try again
      </button>
    </div>
  )
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-xl border border-border p-4 text-center">
      <AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" />
      <p className="mb-3 text-sm text-muted-foreground">{message}</p>
      <button onClick={onRetry} className="text-sm font-medium text-accent">
        try again
      </button>
    </div>
  )
}

function EmptyState({
  radiusKm,
  onWiden,
  onSeeCalendar,
  onFindConnections,
}: {
  radiusKm: number
  onWiden: (() => void) | null
  onSeeCalendar?: () => void
  onFindConnections: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-center">
      <p className="mb-1 text-sm font-medium">no flares within {radiusKm} km</p>
      <p className="mb-4 text-xs text-muted-foreground">
        quiet around here right now — try one of these
      </p>
      <div className="flex flex-col gap-2">
        {onWiden && (
          <button
            onClick={onWiden}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Expand className="h-4 w-4" /> search within {WIDE_RADIUS_KM} km
          </button>
        )}
        {onSeeCalendar && (
          <button
            onClick={onSeeCalendar}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <CalendarIcon className="h-4 w-4" /> see what&apos;s planned
          </button>
        )}
        <button
          onClick={onFindConnections}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Flame className="h-4 w-4" /> connect with your friends
          
        </button>
      </div>
    </div>
  )
}

function sheetSummary(
  loading: boolean,
  refreshing: boolean,
  count: number,
  error: string | null,
  needsLocation: boolean
): string {
  if (needsLocation) return "finding your location"
  if (error) return "tap to retry"
  if (loading) return "loading flares..."
  if (refreshing && count > 0) return `${count} updating`
  if (count === 0) return "no flares near you"
  return `${count} flare${count === 1 ? "" : "s"} near you`
}

function endingInLabel(event: EventItem, now: number = Date.now()): string {
  const end = new Date(event.endAt).getTime()
  const mins = Math.max(0, Math.round((end - now) / 60_000))
  if (mins < 60) return `ending in ${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `ending in ${hours}h` : `ending in ${hours}h ${rem}m`
}

function FlareCard({
  event,
  joined,
  user,
  status,
  onClick,
  onSwipeJoin,
}: {
  event: EventItem
  joined: boolean
  user: GeoCoords | null
  status: "live" | "upcoming" | "ended"
  onClick: () => void
  onSwipeJoin?: () => void
}) {
  const dist = distanceFromUser(event, user)
  const isEnded = status === "ended"
  const isLiveStatus = status === "live"
  const swipeStartX = useRef<number | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const SWIPE_THRESHOLD = 80
  const swipeEnabled = !joined && !isEnded

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeEnabled) return
    swipeStartX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (swipeStartX.current === null) return
    const dx = e.clientX - swipeStartX.current
    setSwipeX(Math.max(0, Math.min(dx, SWIPE_THRESHOLD + 20)))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeStartX.current === null) return
    const dx = e.clientX - swipeStartX.current
    swipeStartX.current = null
    setSwipeX(0)
    if (dx >= SWIPE_THRESHOLD && swipeEnabled) {
      onSwipeJoin?.()
    } else {
      onClick()
    }
  }

  const hostFirst = event.host.name.trim().split(/\s+/)[0]
  const timeLabel = isLiveStatus
    ? endingInLabel(event)
    : isEnded
      ? "ended"
      : formatRelativeStatus(event)
  const metaText = [`by ${hostFirst}`, dist?.label, timeLabel]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe-reveal "I'm in" hint — hidden for ended/joined cards */}
      {swipeEnabled && (
        <div className="absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-xl bg-accent">
          <span className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-accent-foreground">
            <Check className="h-4 w-4" />
            I&apos;m in
          </span>
        </div>
      )}

      <Card
        className={`relative cursor-pointer flex-row items-center gap-3.5 rounded-xl border p-3 transition-colors hover:bg-muted/50 ${
          isLiveStatus
            ? "border-l-[3px] border-l-accent"
            : ""
        } ${isEnded ? "border-border bg-muted/30" : "border-border"}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? "transform 0.2s ease-out" : "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={swipeX > 4 ? undefined : onClick}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isEnded
              ? "bg-muted text-muted-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          {(() => {
            const match = EVENT_TYPES.find((t) => t.value === event.type)
            if (!match) return <span className="text-sm">{event.host.avatar}</span>
            const Icon = match.icon
            return <Icon className="h-5 w-5" />
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={`truncate font-medium ${
                isEnded ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {event.title.split("·", 2)[0]}
            </p>
            {joined && !isEnded && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                <Check className="h-2.5 w-2.5" /> going
              </span>
            )}
          </div>
          <p
            className={`truncate text-xs ${
              isEnded ? "text-muted-foreground/70" : "text-muted-foreground"
            }`}
          >
            {metaText}
          </p>
        </div>
        <ChevronRight
          className={`h-5 w-5 shrink-0 ${
            isEnded ? "text-muted-foreground/50" : "text-muted-foreground"
          }`}
        />
      </Card>
    </div>
  )
}

function FilterChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon?: React.ElementType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  )
}
