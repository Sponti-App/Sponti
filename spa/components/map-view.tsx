"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
  Check,
  Flame,
  LocateFixed,
  MapPin,
  AlertCircle,
} from "lucide-react"
import {
  avatarText,
  distanceFromUser,
  eventCoords,
  formatRelativeStatus,
  isJoined,
  isLive,
  type EventItem,
} from "@/lib/api/events"
import {
  FALLBACK_COORDS,
  useGeolocation,
  type GeoCoords,
  type GeoStatus,
} from "@/lib/geolocation"
import { useMapEvents } from "@/lib/use-events"
import { computeRoute, type RouteResult } from "@/lib/routes-api"

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
    <div className="relative h-full w-full bg-[#d5d0c8]">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, #b8b3ab 1px, transparent 1px),
            linear-gradient(to bottom, #b8b3ab 1px, transparent 1px)
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
              {event.host.avatar}
            </div>
            <div className="mt-1 rounded bg-card px-2 py-1 text-center text-xs shadow-md">
              <span className="font-medium">{event.host.name}</span>
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
  user,
  recenterTick,
}: {
  events: EventItem[]
  onEventSelect: (event: EventItem) => void
  routeResult: RouteResult | null
  routeDestination: GeoCoords | null
  joinedIds: Set<string>
  user: GeoCoords
  recenterTick: number
}) {
  const status = useApiLoadingStatus()
  const map = useMap()

  // Recenter on explicit user action
  useEffect(() => {
    if (!map || recenterTick === 0) return
    map.panTo(user)
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
  }, [map, user, recenterTick])

  if (status === APILoadingStatus.FAILED) {
    return (
      <StaticMapFallback
        events={events}
        onEventSelect={onEventSelect}
        joinedIds={joinedIds}
        user={user}
      />
    )
  }

  return (
    <Map
      defaultCenter={user}
      defaultZoom={15}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      disableDefaultUI
      gestureHandling="greedy"
      className="h-full w-full"
    >
      <AdvancedMarker position={user}>
        <div className="h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
      </AdvancedMarker>
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
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium shadow-lg ${event.host.color} ${avatarText(event.host.color)} ${
                  isJoined(event, joinedIds)
                    ? "ring-2 ring-accent ring-offset-2"
                    : ""
                }`}
              >
                {event.host.avatar}
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
        <FitBoundsOnce origin={user} destination={routeDestination} />
      )}
    </Map>
  )
}

type PeekState = "mini" | "peek" | "expanded"

// Fixed pixel heights for mini and peek states
const SHEET_PX = { mini: 64, peek: 268 } as const

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

export function MapView({
  onEventSelect,
  activeRoute,
  joinedIds,
  onRouteReady,
}: {
  onEventSelect: (event: EventItem) => void
  activeRoute: EventItem | null
  joinedIds: Set<string>
  onRouteReady?: (event: EventItem, etaLabel: string) => void
}) {
  const router = useRouter()
  const [peekState, setPeekState] = useState<PeekState>("peek")
  const dragStartY = useRef<number | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID
  warnIfMissingMapId(apiKey, mapId)
  const [recenterTick, setRecenterTick] = useState(0)

  const geo = useGeolocation()
  const user = geo.coords ?? FALLBACK_COORDS
  const isFallbackLocation = geo.coords == null
  // The recenter button only makes sense on a real interactive map.
  const hasInteractiveMap = !!apiKey

  const map = useMapEvents(geo.coords, 25)
  const mapEvents = useMemo(
    () => map.events.filter((e) => !!e.location.coordinates),
    [map.events]
  )

  // ---- Routes API: compute route + ETA when activeRoute changes ----
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const routeDestination = useMemo<GeoCoords | null>(
    () => (activeRoute ? eventCoords(activeRoute) : null),
    [activeRoute]
  )

  useEffect(() => {
    if (!activeRoute || !routeDestination) {
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
          path: [user, routeDestination],
          durationSeconds: 0,
          distanceMeters: 0,
          etaLabel: "",
          distanceLabel: "",
        })
      )
      return
    }
    const ac = new AbortController()
    computeRoute(user, routeDestination, "WALK", ac.signal)
      .then((result) => {
        setRouteResult(result)
        setRouteError(null)
        if (result.etaLabel) onRouteReady?.(activeRoute, result.etaLabel)
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        // Fall back to a straight line so the user still has *some* visual
        const fallback: RouteResult = {
          path: [user, routeDestination],
          durationSeconds: 0,
          distanceMeters: 0,
          etaLabel: "",
          distanceLabel: "",
        }
        setRouteResult(fallback)
        setRouteError(err instanceof Error ? err.message : "Route unavailable")
      })
    return () => ac.abort()
    // user lat/lng change every geolocation tick — only recompute on activeRoute change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute?.id, routeDestination?.lat, routeDestination?.lng, apiKey])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return
    const delta = e.clientY - dragStartY.current
    dragStartY.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    if (delta > 60) {
      if (peekState === "expanded") setPeekState("peek")
      else if (peekState === "peek") setPeekState("mini")
    } else if (delta < -60) {
      if (peekState === "mini") setPeekState("peek")
      else if (peekState === "peek") setPeekState("expanded")
    }
  }

  const sheetStyle =
    peekState === "expanded"
      ? { height: "100%" }
      : { height: `${SHEET_PX[peekState]}px` }

  const fabBottomPx =
    peekState === "mini" ? SHEET_PX.mini + 12 : SHEET_PX.peek + 12

  return (
    <div className="absolute inset-0 overflow-hidden">
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMapContent
            events={mapEvents}
            onEventSelect={onEventSelect}
            routeResult={routeResult}
            routeDestination={routeDestination}
            joinedIds={joinedIds}
            user={user}
            recenterTick={recenterTick}
          />
        </APIProvider>
      ) : (
        <StaticMapFallback
          events={mapEvents}
          onEventSelect={onEventSelect}
          joinedIds={joinedIds}
          user={user}
        />
      )}

      {/* Geolocation banners */}
      <GeolocationBanner status={geo.status} onRetry={geo.request} />

      {/* Route error banner — anchored top-right under the geolocation banner. */}
      {routeError && (
        <div className="absolute top-14 right-3 z-30 flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs shadow">
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span>Route unavailable</span>
        </div>
      )}

      {/* Recenter button — only meaningful on a real Google map; hidden in the
          static fallback where pan/zoom and panTo don't apply. */}
      {hasInteractiveMap && (
        <button
          type="button"
          onClick={() => {
            if (isFallbackLocation) geo.request()
            else setRecenterTick((n) => n + 1)
          }}
          style={{ bottom: `${fabBottomPx + 64}px` }}
          aria-label="Recenter on my location"
          className="absolute right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-[bottom] duration-300 ease-out"
        >
          <LocateFixed className="h-5 w-5" />
        </button>
      )}

      {/* Floating + flare FAB — hidden when sheet is fully expanded */}
      {peekState !== "expanded" && (
        <button
          onClick={() => router.push("/event/new")}
          style={{ bottom: `${fabBottomPx}px` }}
          className="absolute right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl transition-[bottom] duration-300 ease-out"
          aria-label="Light a flare"
        >
          <Flame className="h-6 w-6" />
        </button>
      )}

      {/* Bottom sheet — z-50 when expanded so it covers the nav pill */}
      <div
        style={sheetStyle}
        className={`absolute right-0 bottom-0 left-0 rounded-t-3xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out ${
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
            className="flex w-full items-center justify-center gap-2 pb-1 text-sm text-muted-foreground"
          >
            <ChevronUp className="h-4 w-4" />
            {sheetSummary(map.loading, mapEvents.length, map.error)}
          </button>
        ) : (
          <div
            className={`h-[calc(100%-44px)] overflow-y-auto px-4 ${
              peekState === "expanded" ? "pb-8" : "pb-24"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Flares near you</h2>
              <span className="text-sm text-muted-foreground">
                {map.loading ? "loading…" : `${mapEvents.length} active`}
              </span>
            </div>
            {map.error ? (
              <ErrorPanel message={map.error} onRetry={map.refresh} />
            ) : mapEvents.length === 0 && !map.loading ? (
              <EmptyState onCreate={() => router.push("/event/new")} />
            ) : (
              <div className="space-y-2">
                {mapEvents.map((event) => (
                  <FlareCard
                    key={event.id}
                    event={event}
                    joined={isJoined(event, joinedIds)}
                    user={geo.coords}
                    onClick={() => onEventSelect(event)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GeolocationBanner({
  status,
  onRetry,
}: {
  status: GeoStatus
  onRetry: () => void
}) {
  if (status === "granted" || status === "idle" || status === "requesting")
    return null
  const msg =
    status === "denied"
      ? "showing approximate area — enable location to find flares near you"
      : "couldn't get your location — showing approximate area"
  return (
    <div className="absolute top-3 right-3 left-3 z-30 flex items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 text-xs shadow-md">
      <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span className="flex-1">{msg}</span>
      <button onClick={onRetry} className="shrink-0 font-medium text-accent">
        retry
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="mb-3 text-sm text-muted-foreground">
        no flares near you right now
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
      >
        <Flame className="h-4 w-4" /> light the first one
      </button>
    </div>
  )
}

function sheetSummary(
  loading: boolean,
  count: number,
  error: string | null
): string {
  if (error) return "tap to retry"
  if (loading) return "loading flares…"
  if (count === 0) return "no flares near you"
  return `${count} flare${count === 1 ? "" : "s"} near you`
}

function FlareCard({
  event,
  joined,
  user,
  onClick,
}: {
  event: EventItem
  joined: boolean
  user: GeoCoords | null
  onClick: () => void
}) {
  const dist = distanceFromUser(event, user)
  return (
    <Card
      className={`cursor-pointer flex-row items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50 ${
        joined ? "border-accent bg-accent/5" : "border-border"
      }`}
      onClick={onClick}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${event.host.color} ${avatarText(event.host.color)}`}
      >
        {event.host.avatar}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-medium text-accent">
            {event.type} · {event.host.name}
          </p>
          {joined && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              <Check className="h-2.5 w-2.5" /> going
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {formatRelativeStatus(event)} · {event.location.name}
          {dist ? ` · ${dist.label}` : ""}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Card>
  )
}
