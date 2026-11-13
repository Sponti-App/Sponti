// The flat fallback map (no Maps key, or the SDK failed) has no camera, so a
// drag on its backdrop moves a virtual one at a fixed scale. It reports the
// centre on release, like the real map's idle, so "search this area" (#642)
// works there too and the e2e suite can pan.

import { useRef, type PointerEvent } from "react"

import type { GeoCoords } from "@/lib/geolocation"

const METERS_PER_DEGREE_LAT = 111_320

export function useStaticPan(
  start: GeoCoords,
  metersPerPx: number,
  onCenter: (center: GeoCoords) => void
) {
  const centerRef = useRef(start)
  const from = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: PointerEvent<Element>) => {
      from.current = { x: e.clientX, y: e.clientY }
      // So the release is ours even over a pin or the sheet.
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerUp: (e: PointerEvent) => {
      if (!from.current) return
      const dx = e.clientX - from.current.x
      const dy = e.clientY - from.current.y
      from.current = null
      if (dx === 0 && dy === 0) return
      const { lat, lng } = centerRef.current
      // Dragging the map right/down moves the camera west/north.
      centerRef.current = {
        lat: lat + (dy * metersPerPx) / METERS_PER_DEGREE_LAT,
        lng:
          lng -
          (dx * metersPerPx) /
            (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)),
      }
      onCenter(centerRef.current)
    },
  }
}
