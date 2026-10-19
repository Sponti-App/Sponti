"use client"

// PROTOTYPE (#615) — throwaway. The home map behind the drawer: one-finger
// gestures, the mock flares' pins, the viewer's dot, and the focus rule. While
// a flare is open the map pans so its pin sits in the middle of the map that's
// still visible above the drawer, and it never pans back to the viewer.

import { useEffect, useRef } from "react"
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps"
import { useTheme } from "next-themes"
import { MapPinIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"
import { FLARES, VIEWER, type LatLng, type MockFlare } from "./_mock"

export function PrototypeMap({
  focus,
  visibleHeight,
  focusKey,
  onPinTap,
  onUserPan,
}: {
  focus: MockFlare | null
  /** Height of the map left above the drawer, in px. */
  visibleHeight: number
  /** Changes whenever the map should re-centre (flare, snap, recentre tap). */
  focusKey: string
  onPinTap: (flare: MockFlare) => void
  onUserPan: () => void
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { resolvedTheme } = useTheme()

  if (!apiKey) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
        no maps key: set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    )
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={VIEWER}
        defaultZoom={14}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
        colorScheme={resolvedTheme === "dark" ? "DARK" : "LIGHT"}
        disableDefaultUI
        // One finger, like the home map. The old hero used "cooperative",
        // which is what made people reach for two fingers.
        gestureHandling="greedy"
        clickableIcons={false}
        className="absolute inset-0"
        onDragstart={onUserPan}
      >
        <AdvancedMarker position={VIEWER}>
          <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
        </AdvancedMarker>
        {FLARES.map((f) => (
          <AdvancedMarker
            key={f.id}
            position={f.coords}
            onClick={() => onPinTap(f)}
            zIndex={focus?.id === f.id ? 10 : 1}
          >
            <Pin flare={f} selected={focus?.id === f.id} />
          </AdvancedMarker>
        ))}
        <FocusController
          target={focus?.coords ?? null}
          visibleHeight={visibleHeight}
          focusKey={focusKey}
        />
      </Map>
    </APIProvider>
  )
}

function FocusController({
  target,
  visibleHeight,
  focusKey,
}: {
  target: LatLng | null
  visibleHeight: number
  focusKey: string
}) {
  const map = useMap()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (!map || !target) return
    if (last.current === focusKey) return
    // Under a full-height drawer there's nothing to centre in.
    if (visibleHeight < 64) return
    const center = offsetCenter(map, target, visibleHeight)
    if (center) {
      last.current = focusKey
      map.panTo(center)
      return
    }
    // First load: the projection isn't ready yet, so centre once it is.
    const listener = map.addListener("idle", () => {
      listener.remove()
      const ready = offsetCenter(map, target, visibleHeight)
      if (!ready) return
      last.current = focusKey
      map.setCenter(ready)
    })
    return () => listener.remove()
  }, [map, target, visibleHeight, focusKey])

  return null
}

/**
 * The map centre that puts `target` halfway down the visible strip at the
 * top of the map, given the map fills the screen behind the drawer.
 */
function offsetCenter(
  map: google.maps.Map,
  target: LatLng,
  visibleHeight: number
): google.maps.LatLng | null {
  const projection = map.getProjection()
  const zoom = map.getZoom()
  const div = map.getDiv()
  if (!projection || zoom === undefined || !div) return null
  const scale = 2 ** zoom
  const point = projection.fromLatLngToPoint(target)
  if (!point) return null
  // Pixels the pin must sit above the map's middle.
  const dy = div.clientHeight / 2 - visibleHeight / 2
  return projection.fromPointToLatLng(
    new google.maps.Point(point.x, point.y + dy / scale)
  )
}

function Pin({ flare, selected }: { flare: MockFlare; selected: boolean }) {
  const Icon =
    EVENT_TYPES.find((t) => t.value === flare.type)?.icon ?? MapPinIcon
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border-2 border-background shadow-lg transition-transform",
        flare.visibility === "private"
          ? "bg-flare-invite text-flare-invite-ink"
          : "bg-flare-open text-flare-open-ink",
        flare.timing === "live" && "ring-3 ring-primary",
        selected ? "h-12 w-12 scale-110" : "h-10 w-10"
      )}
    >
      <Icon className={selected ? "h-6 w-6" : "h-5 w-5"} />
    </div>
  )
}
