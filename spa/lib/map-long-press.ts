// #178: a long-press on the home map yields the pressed point. What it opens
// is the caller's business (today the composer with the place filled in; a
// quick "here" pin later, #643), so nothing here knows about flares.
//
// The handlers go on an element that wraps the map, in the capture phase:
// Google's map handles the pointer events of its own canvas, and a capture
// listener on an ancestor still sees them all first.

import { useEffect, useState } from "react"
import { sessionFetch } from "@/lib/http"
import type { DraftEventLocation } from "@/lib/api/events"

/** The standard long-press threshold on phones. */
export const LONG_PRESS_MS = 500
/** A finger that moves further than this is panning, not pressing. */
export const LONG_PRESS_SLOP_PX = 10

export type ScreenPoint = { x: number; y: number }

type PointerLike = {
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
  target: EventTarget | null
}
type ContextMenuLike = {
  clientX: number
  clientY: number
  target: EventTarget | null
  preventDefault: () => void
}

// Presses on a pin, a button or a link belong to that element.
const OWN_TARGETS = "button, a, [role='button'], gmp-advanced-marker"
function onOwnTarget(target: EventTarget | null): boolean {
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest(OWN_TARGETS) !== null
  )
}

/**
 * The gesture itself, as plain handlers (testable without a DOM). A touch or
 * pen held still for LONG_PRESS_MS fires `onPress` with the client point. It
 * is cancelled by moving past the slop, a second finger (pinch), lifting or
 * pointercancel. A mouse has no long-press: its right-click (contextmenu)
 * fires instead, the desktop equivalent.
 */
export function createLongPress(
  onPress: (point: ScreenPoint) => void,
  { delay = LONG_PRESS_MS, slop = LONG_PRESS_SLOP_PX } = {}
) {
  const down = new Map<number, ScreenPoint>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let start: (ScreenPoint & { id: number }) | null = null
  let lastType = "mouse"
  let press = onPress

  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    start = null
  }

  return {
    onPointerDownCapture(e: PointerLike) {
      lastType = e.pointerType
      down.set(e.pointerId, { x: e.clientX, y: e.clientY })
      cancel()
      if (e.pointerType === "mouse" || down.size > 1) return
      if (onOwnTarget(e.target)) return
      start = { id: e.pointerId, x: e.clientX, y: e.clientY }
      timer = setTimeout(() => {
        const point = { x: start!.x, y: start!.y }
        cancel()
        press(point)
      }, delay)
    },
    onPointerMoveCapture(e: PointerLike) {
      if (!start || e.pointerId !== start.id) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > slop) cancel()
    },
    onPointerUpCapture(e: PointerLike) {
      down.delete(e.pointerId)
      cancel()
    },
    onPointerCancelCapture(e: PointerLike) {
      down.delete(e.pointerId)
      cancel()
    },
    onContextMenuCapture(e: ContextMenuLike) {
      // A held finger fires contextmenu on Android; the timer covers touch.
      e.preventDefault()
      if (lastType !== "mouse" || onOwnTarget(e.target)) return
      press({ x: e.clientX, y: e.clientY })
    },
    cancel,
    setOnPress(next: (point: ScreenPoint) => void) {
      press = next
    },
  }
}

/** `createLongPress` for a React element; off when `enabled` is false. */
export function useMapLongPress(
  onPress: (point: ScreenPoint) => void,
  enabled: boolean
) {
  // One gesture for the element's life, so a re-render mid-press keeps it.
  const [handlers] = useState(() => createLongPress(onPress))
  useEffect(() => handlers.setOnPress(onPress), [handlers, onPress])
  if (!enabled) return {}
  const {
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
    onContextMenuCapture,
  } = handlers
  return {
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
    onContextMenuCapture,
  }
}

const TILE = 256

/**
 * The lat/lng under a point of a Web Mercator map of `size` px centred on
 * `center` at `zoom`, `point` relative to the map's top-left corner.
 * shortcut: ignores tilt and heading (the home map uses neither); a tilted
 * vector map would need the map's own projection.
 */
export function containerPointToLatLng(
  center: { lat: number; lng: number },
  zoom: number,
  size: { width: number; height: number },
  point: ScreenPoint
): { lat: number; lng: number } {
  const scale = TILE * 2 ** zoom
  const siny = Math.sin((center.lat * Math.PI) / 180)
  const cx = ((center.lng + 180) / 360) * scale
  const cy = (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * scale
  const x = cx + point.x - size.width / 2
  const y = cy + point.y - size.height / 2
  const lng = (x / scale) * 360 - 180
  const lat =
    (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / scale)) * 180) / Math.PI
  return { lat, lng }
}

/** What a pressed place is called when the lookup has nothing. */
export const PRESSED_PLACE_FALLBACK = "dropped pin"

/**
 * The composer's place for a pressed point, from /api/geocode's answer
 * (`{ area, locality }`, never a street address): the neighbourhood with the
 * city under it, else the city, else PRESSED_PLACE_FALLBACK. The pin stays
 * on the pressed coordinates either way.
 */
export function pressedPlace(
  coords: { lat: number; lng: number },
  geocode: unknown
): DraftEventLocation {
  const g = (geocode ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === "string" && v.trim()) || null
  const area = text(g.area)
  const locality = text(g.locality)
  const named = area && area !== locality
  return {
    source: "place",
    name: named ? area : (locality ?? PRESSED_PLACE_FALLBACK),
    address: named ? locality : null,
    coordinates: [coords.lng, coords.lat],
  }
}

const LOOKUP_TIMEOUT_MS = 3_000

/** Resolves a pressed point to the composer's place; never rejects. */
export async function lookUpPressedPlace(coords: {
  lat: number
  lng: number
}): Promise<DraftEventLocation> {
  const params = new URLSearchParams({
    lat: String(coords.lat),
    lng: String(coords.lng),
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
  try {
    const resp = await sessionFetch(`/api/geocode?${params}`, {
      signal: controller.signal,
    })
    return pressedPlace(coords, resp.ok ? await resp.json() : null)
  } catch {
    return pressedPlace(coords, null)
  } finally {
    clearTimeout(timeout)
  }
}
