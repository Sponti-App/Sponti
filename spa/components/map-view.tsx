"use client"

import { useEffect, useRef, useState } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
  APILoadingStatus,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps"
import { Card } from "@/components/ui/card"
import { ChevronRight, ChevronUp, Check } from "lucide-react"
import { avatarText, events } from "@/lib/events"
import type { EventItem } from "@/lib/events"

const mapEvents = events.filter((e) => e.position != null)

const userLocation = { lat: 37.7849, lng: -122.4344 }

// Hex equivalent of --color-brand (oklch 0.57 0.18 28) — Google Maps Polyline
// does not accept CSS variables, so we mirror the token here. Keep in sync with globals.css.
const BRAND_HEX = "#cc3e35"

// Pixel positions of the static map markers (used to draw route on static fallback)
const STATIC_MARKER_PX: Record<number, { x: number; y: number }> = {
  1: { x: 109, y: 160 },
  2: { x: 343, y: 260 },
}
const STATIC_USER_PX = { x: 195, y: 250 }

function GoogleMapPolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: BRAND_HEX,
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

function StaticMapFallback({
  onEventSelect,
  route,
  joinedIds,
}: {
  onEventSelect: (event: EventItem) => void
  route: EventItem | null
  joinedIds: Set<number>
}) {
  const routePx = route?.id ? STATIC_MARKER_PX[route.id] : null

  return (
    <div className="w-full h-full bg-[#d5d0c8] relative">
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
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 390 500"
        preserveAspectRatio="none"
      >
        <path d="M-20 120 Q120 160 200 100 Q280 40 420 80" stroke="#c4bfb7" strokeWidth="28" fill="none" />
        <path d="M-20 320 Q100 280 180 220 Q260 160 420 140" stroke="#c4bfb7" strokeWidth="28" fill="none" />
        <path d="M140 -20 Q170 120 150 220 Q130 320 170 520" stroke="#c4bfb7" strokeWidth="24" fill="none" />
        <path d="M300 -20 Q280 100 290 200 Q300 300 260 520" stroke="#c4bfb7" strokeWidth="20" fill="none" />
        {routePx && (
          <line
            x1={STATIC_USER_PX.x}
            y1={STATIC_USER_PX.y}
            x2={routePx.x}
            y2={routePx.y}
            stroke="var(--color-brand)"
            strokeWidth="4"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-4 h-4 bg-brand rounded-full border-2 border-background shadow-lg" />
      </div>
      <button
        onClick={() => onEventSelect(events[0])}
        className="absolute top-[32%] left-[28%] flex flex-col items-center cursor-pointer"
      >
        <div
          className={`w-10 h-10 bg-brand rounded-full flex items-center justify-center text-brand-foreground text-sm font-medium shadow-lg ${
            joinedIds.has(events[0].id) ? "ring-2 ring-brand ring-offset-2" : ""
          }`}
        >
          M
        </div>
        <div className="mt-1 px-2 py-1 bg-card rounded-lg text-xs shadow-md text-center">
          <span className="font-medium italic">Mira</span>
          <br />
          <span className="text-muted-foreground italic">0.4 mi</span>
        </div>
      </button>
      <button
        onClick={() => onEventSelect(events[1])}
        className="absolute top-[52%] right-[12%] flex flex-col items-center cursor-pointer"
      >
        <div
          className={`w-10 h-10 bg-stone-800 rounded-full flex items-center justify-center text-brand-foreground shadow-lg ${
            joinedIds.has(events[1].id) ? "ring-2 ring-brand ring-offset-2" : ""
          }`}
        >
          <span className="text-xs">👥</span>
        </div>
        <div className="mt-1 px-2 py-1 bg-stone-800 rounded-lg text-xs font-medium text-brand-foreground shadow-md text-center italic">
          Sam
          <br />
          +3
        </div>
      </button>
    </div>
  )
}

function GoogleMapContent({
  onEventSelect,
  route,
  joinedIds,
}: {
  onEventSelect: (event: EventItem) => void
  route: EventItem | null
  joinedIds: Set<number>
}) {
  const status = useApiLoadingStatus()

  if (status === APILoadingStatus.FAILED) {
    return <StaticMapFallback onEventSelect={onEventSelect} route={route} joinedIds={joinedIds} />
  }

  return (
    <Map
      defaultCenter={userLocation}
      defaultZoom={15}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      disableDefaultUI={true}
      className="w-full h-full"
    >
      <AdvancedMarker position={userLocation}>
        <div className="w-4 h-4 bg-brand rounded-full border-2 border-background shadow-lg" />
      </AdvancedMarker>
      {mapEvents.map((event) => (
        <AdvancedMarker
          key={event.id}
          position={event.position!}
          onClick={() => onEventSelect(event)}
        >
          <div className="flex flex-col items-center cursor-pointer">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shadow-lg ${event.host.color} ${avatarText(event.host.color)} ${
                joinedIds.has(event.id) ? "ring-2 ring-brand ring-offset-2" : ""
              }`}
            >
              {event.host.avatar}
            </div>
            <div className="mt-1 px-2 py-0.5 bg-card rounded text-xs font-medium shadow">
              {event.location.distance}
            </div>
          </div>
        </AdvancedMarker>
      ))}
      {route?.position && (
        <GoogleMapPolyline path={[userLocation, route.position]} />
      )}
    </Map>
  )
}

type PeekState = "peek" | "mini"

export function MapView({
  onEventSelect,
  activeRoute,
  joinedIds,
}: {
  onEventSelect: (event: EventItem) => void
  activeRoute: EventItem | null
  joinedIds: Set<number>
}) {
  const [peekState, setPeekState] = useState<PeekState>("peek")
  const dragStartY = useRef<number | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

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
      // pointer already released
    }
    if (delta > 50 && peekState === "peek") setPeekState("mini")
    if (delta < -50 && peekState === "mini") setPeekState("peek")
  }

  return (
    <div className="flex-1 h-full relative overflow-hidden">
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMapContent
            onEventSelect={onEventSelect}
            route={activeRoute}
            joinedIds={joinedIds}
          />
        </APIProvider>
      ) : (
        <StaticMapFallback
          onEventSelect={onEventSelect}
          route={activeRoute}
          joinedIds={joinedIds}
        />
      )}

      {/* Peek bottom sheet — z-20, sits below floating nav (z-40) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-background rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out ${
          peekState === "peek" ? "h-[36%]" : "h-12"
        }`}
      >
        {/* Drag handle — always draggable */}
        <div
          className="flex justify-center py-3 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {peekState === "mini" ? (
          /* Mini state — just a prompt to restore */
          <button
            onClick={() => setPeekState("peek")}
            className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground pb-1"
          >
            <ChevronUp className="w-4 h-4" />
            {mapEvents.length} flares near you
          </button>
        ) : (
          /* Peek state — flares list */
          <div className="px-4 pb-24 overflow-y-auto h-[calc(100%-44px)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Flares near you</h2>
              <span className="text-sm text-muted-foreground">{mapEvents.length} active</span>
            </div>
            <div className="space-y-2">
              {mapEvents.map((event) => (
                <FlareCard
                  key={event.id}
                  event={event}
                  joined={joinedIds.has(event.id)}
                  onClick={() => onEventSelect(event)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FlareCard({
  event,
  joined,
  onClick,
}: {
  event: EventItem
  joined: boolean
  onClick: () => void
}) {
  return (
    <Card
      className={`p-3 flex-row items-center gap-3 border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors ${
        joined ? "border-brand bg-brand/5" : "border-border"
      }`}
      onClick={onClick}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${event.host.color} ${avatarText(event.host.color)}`}
      >
        {event.host.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-brand truncate">
            {event.type} · {event.host.name}
          </p>
          {joined && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium bg-brand/10 text-brand px-1.5 py-0.5 rounded-full shrink-0">
              <Check className="w-2.5 h-2.5" /> going
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {event.status} · {event.location.name} · {event.location.distance}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
    </Card>
  )
}
