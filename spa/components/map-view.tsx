"use client"

import { useEffect, useRef, useState } from "react"
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
import { ChevronRight, ChevronUp, Check, Flame } from "lucide-react"
import { avatarText, events } from "@/lib/events"
import type { EventItem } from "@/lib/events"

const mapEvents = events.filter((e) => e.position != null)

const userLocation = { lat: 37.7849, lng: -122.4344 }

// Hex equivalent of --accent (oklch 0.55 0.19 25) — Google Maps Polyline
// does not accept CSS variables, so we mirror the token here. Keep in sync with globals.css.
const ACCENT_HEX = "#c44040"

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
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 390 500"
        preserveAspectRatio="none"
      >
        <path
          d="M-20 120 Q120 160 200 100 Q280 40 420 80"
          stroke="#c4bfb7"
          strokeWidth="28"
          fill="none"
        />
        <path
          d="M-20 320 Q100 280 180 220 Q260 160 420 140"
          stroke="#c4bfb7"
          strokeWidth="28"
          fill="none"
        />
        <path
          d="M140 -20 Q170 120 150 220 Q130 320 170 520"
          stroke="#c4bfb7"
          strokeWidth="24"
          fill="none"
        />
        <path
          d="M300 -20 Q280 100 290 200 Q300 300 260 520"
          stroke="#c4bfb7"
          strokeWidth="20"
          fill="none"
        />
        {routePx && (
          <line
            x1={STATIC_USER_PX.x}
            y1={STATIC_USER_PX.y}
            x2={routePx.x}
            y2={routePx.y}
            stroke="var(--accent)"
            strokeWidth="4"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
      </div>
      <button
        onClick={() => onEventSelect(events[0])}
        className="absolute top-[32%] left-[28%] flex cursor-pointer flex-col items-center"
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground shadow-lg ${
            joinedIds.has(events[0].id)
              ? "ring-2 ring-accent ring-offset-2"
              : ""
          }`}
        >
          M
        </div>
        <div className="mt-1 rounded-lg bg-card px-2 py-1 text-center text-xs shadow-md">
          <span className="font-medium italic">Mira</span>
          <br />
          <span className="text-muted-foreground italic">0.4 mi</span>
        </div>
      </button>
      <button
        onClick={() => onEventSelect(events[1])}
        className="absolute top-[52%] right-[12%] flex cursor-pointer flex-col items-center"
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-stone-800 text-accent-foreground shadow-lg ${
            joinedIds.has(events[1]?.id)
              ? "ring-2 ring-accent ring-offset-2"
              : ""
          }`}
        >
          <span className="text-xs">👥</span>
        </div>
        <div className="mt-1 rounded-lg bg-stone-800 px-2 py-1 text-center text-xs font-medium text-accent-foreground italic shadow-md">
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
    return (
      <StaticMapFallback
        onEventSelect={onEventSelect}
        route={route}
        joinedIds={joinedIds}
      />
    )
  }

  return (
    <Map
      defaultCenter={userLocation}
      defaultZoom={15}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
      disableDefaultUI={true}
      className="h-full w-full"
    >
      <AdvancedMarker position={userLocation}>
        <div className="h-4 w-4 rounded-full border-2 border-background bg-accent shadow-lg" />
      </AdvancedMarker>
      {mapEvents.map((event) => (
        <AdvancedMarker
          key={event.id}
          position={event.position!}
          onClick={() => onEventSelect(event)}
        >
          <div className="flex cursor-pointer flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium shadow-lg ${event.host.color} ${avatarText(event.host.color)} ${
                joinedIds.has(event.id)
                  ? "ring-2 ring-accent ring-offset-2"
                  : ""
              }`}
            >
              {event.host.avatar}
            </div>
            <div className="mt-1 rounded bg-card px-2 py-0.5 text-xs font-medium shadow">
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

type PeekState = "mini" | "peek" | "expanded"

// Fixed pixel heights for mini and peek states
const SHEET_PX = { mini: 64, peek: 268 } as const

export function MapView({
  onEventSelect,
  activeRoute,
  joinedIds,
}: {
  onEventSelect: (event: EventItem) => void
  activeRoute: EventItem | null
  joinedIds: Set<number>
}) {
  const router = useRouter()
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

  // FAB sits 12px above the sheet top edge; hidden when sheet is fully expanded
  const fabBottomPx =
    peekState === "mini" ? SHEET_PX.mini + 12 : SHEET_PX.peek + 12

  return (
    <div className="relative h-full flex-1 overflow-hidden">
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
        {/* Drag handle */}
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
            {mapEvents.length} flares near you
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
                {mapEvents.length} active
              </span>
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
          {event.status} · {event.location.name} · {event.location.distance}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Card>
  )
}
