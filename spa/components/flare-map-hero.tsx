"use client"

// The map at the top of the flare detail page (#139): the flare's pin, the
// viewer's location, and a walking route when they're within 2 km. Falls back
// to a static tile with the pin when there's no Maps key or it fails to load.

import { useEffect, useMemo, useState } from "react"
import {
  APIProvider,
  AdvancedMarker,
  APILoadingStatus,
  Map,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps"
import { useTheme } from "next-themes"
import { MapPinIcon } from "@/components/icons"
import {
  FitBoundsOnce,
  GoogleMapPolyline,
} from "@/components/google-map-overlays"
import {
  formatDistance,
  haversineMeters,
  type EventCoordinates,
  type EventType,
} from "@/lib/api/events"
import { shouldDrawRoute, type FlareViewer } from "@/lib/flare-detail"
import { useGeolocation, type GeoCoords } from "@/lib/geolocation"
import { computeRoute, type RouteResult } from "@/lib/routes-api"
import { EVENT_TYPES } from "@/types/utils"

export type FlareDirections = {
  viewerCoords: GeoCoords | null
  distanceMeters: number | null
  /** Set only when the route is drawn (within 2 km, not the host). */
  route: RouteResult | null
  /** "14 min walk" when routed, "8.4 km away" otherwise, null if unknown. */
  travelLabel: string | null
}

export function useFlareDirections({
  coordinates,
  viewer,
}: {
  coordinates?: EventCoordinates | null
  viewer: FlareViewer
}): FlareDirections {
  const geo = useGeolocation()
  const viewerCoords = geo.coords ?? geo.lastKnownCoords
  const distanceMeters =
    viewerCoords && coordinates
      ? haversineMeters(viewerCoords, coordinates)
      : null
  const drawRoute = shouldDrawRoute({ viewer, distanceMeters })
  const [route, setRoute] = useState<RouteResult | null>(null)

  // Round the origin so GPS jitter doesn't refetch the route every tick.
  const originKey = viewerCoords
    ? `${viewerCoords.lat.toFixed(4)},${viewerCoords.lng.toFixed(4)}`
    : null
  const destinationKey = coordinates
    ? `${coordinates.lat},${coordinates.lng}`
    : null

  useEffect(() => {
    if (!drawRoute || !originKey || !destinationKey) return
    const [oLat, oLng] = originKey.split(",").map(Number)
    const [dLat, dLng] = destinationKey.split(",").map(Number)
    const ac = new AbortController()
    computeRoute(
      { lat: oLat, lng: oLng },
      { lat: dLat, lng: dLng },
      "WALK",
      ac.signal
    )
      .then(setRoute)
      .catch((err) => {
        if (!ac.signal.aborted) console.warn("[Sponti] route failed:", err)
      })
    return () => ac.abort()
  }, [drawRoute, originKey, destinationKey])

  const shownRoute = drawRoute ? route : null
  const travelLabel = shownRoute
    ? `${shownRoute.etaLabel} walk`
    : distanceMeters !== null
      ? `${formatDistance(distanceMeters)} away`
      : null

  return { viewerCoords, distanceMeters, route: shownRoute, travelLabel }
}

export function FlareMapHero({
  coordinates,
  type,
  directions,
  children,
}: {
  coordinates?: EventCoordinates | null
  type: EventType
  directions: FlareDirections
  /** Overlays: header buttons, "open in maps". */
  children?: React.ReactNode
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return (
    <div className="relative h-56 overflow-hidden bg-muted">
      {apiKey && coordinates ? (
        <APIProvider apiKey={apiKey}>
          <HeroMap
            coordinates={coordinates}
            type={type}
            directions={directions}
          />
        </APIProvider>
      ) : (
        <StaticHero type={type} />
      )}
      {children}
    </div>
  )
}

function HeroMap({
  coordinates,
  type,
  directions,
}: {
  coordinates: EventCoordinates
  type: EventType
  directions: FlareDirections
}) {
  const status = useApiLoadingStatus()
  const { resolvedTheme } = useTheme()
  const { route, viewerCoords } = directions
  const path = useMemo(() => route?.path ?? [], [route])

  if (status === APILoadingStatus.FAILED) return <StaticHero type={type} />

  return (
    <Map
      defaultCenter={coordinates}
      defaultZoom={15}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      colorScheme={resolvedTheme === "dark" ? "DARK" : "LIGHT"}
      disableDefaultUI
      gestureHandling="cooperative"
      className="h-full w-full"
    >
      <AdvancedMarker position={coordinates}>
        <FlarePin type={type} />
      </AdvancedMarker>
      {route && viewerCoords && (
        <>
          <AdvancedMarker position={viewerCoords}>
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
          </AdvancedMarker>
          <GoogleMapPolyline path={path} />
          <FitBoundsOnce
            origin={viewerCoords}
            destination={coordinates}
            // Clear the back button up top and the "open in maps" pill and
            // overlapping sheet at the bottom.
            padding={{ top: 44, bottom: 56, left: 32, right: 32 }}
          />
        </>
      )}
    </Map>
  )
}

function StaticHero({ type }: { type: EventType }) {
  return (
    <div className="relative h-full w-full">
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
      <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2">
        <FlarePin type={type} />
      </div>
    </div>
  )
}

function FlarePin({ type }: { type: EventType }) {
  const Icon = EVENT_TYPES.find((t) => t.value === type)?.icon ?? MapPinIcon
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent bg-background shadow-lg">
      <Icon className="h-5 w-5 text-accent" />
    </div>
  )
}
