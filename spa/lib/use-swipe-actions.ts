"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import type React from "react"
import { haptic } from "@/lib/haptics"

// Swipe a feed row sideways as a shortcut (#173, #226): right to accept a
// request, left to hide the row. The buttons on the row do the same things;
// this is only the fast path.
//
// Feel:
// - The row follows the finger 1:1 once the drag is clearly sideways.
// - A mostly-vertical drag is left alone, so the list still scrolls. The
//   row sets `touch-action: pan-y`, which hands vertical pans to the browser
//   and horizontal ones to us.
// - Let go short of the threshold and it springs back; past it, it commits.
// - A direction with nothing behind it resists (rubber-band) instead of
//   sliding freely.
// - Reduced motion: still follows the finger (that's direct manipulation,
//   not animation), but no fly-out or spring-back.

/** Movement before we decide whether a drag is sideways or a scroll. */
export const SWIPE_SLOP_PX = 10
/** How much more sideways than vertical a drag must be to count as a swipe. */
export const SWIPE_AXIS_RATIO = 1.2
const MIN_THRESHOLD_PX = 72
const MAX_THRESHOLD_PX = 120
const THRESHOLD_RATIO = 0.3
const RESISTANCE = 0.15
const SETTLE_MS = 180

export type SwipeDirection = "left" | "right"
export type GestureAxis = "undecided" | "horizontal" | "vertical"

export function classifyGesture(
  dx: number,
  dy: number,
  slop = SWIPE_SLOP_PX
): GestureAxis {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < slop && ay < slop) return "undecided"
  return ax > ay * SWIPE_AXIS_RATIO ? "horizontal" : "vertical"
}

/** Distance a row has to travel to commit, scaled to its width. */
export function swipeThreshold(width: number): number {
  return Math.min(
    MAX_THRESHOLD_PX,
    Math.max(MIN_THRESHOLD_PX, width * THRESHOLD_RATIO)
  )
}

export function resistedOffset(
  dx: number,
  allowed: { left: boolean; right: boolean }
): number {
  if (dx > 0 && !allowed.right) return dx * RESISTANCE
  if (dx < 0 && !allowed.left) return dx * RESISTANCE
  return dx
}

export function swipeOutcome(
  offset: number,
  threshold: number,
  allowed: { left: boolean; right: boolean }
): SwipeDirection | null {
  if (offset >= threshold && allowed.right) return "right"
  if (offset <= -threshold && allowed.left) return "left"
  return null
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

type Drag = {
  pointerId: number
  startX: number
  startY: number
  axis: GestureAxis
  width: number
}

export function useSwipeActions({
  onSwipeLeft,
  onSwipeRight,
}: {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  // Latest callbacks, read from the pointer handlers so they stay stable.
  const callbacks = useRef({ onSwipeLeft, onSwipeRight })
  useLayoutEffect(() => {
    callbacks.current = { onSwipeLeft, onSwipeRight }
  })
  const allowedNow = () => ({
    left: Boolean(callbacks.current.onSwipeLeft),
    right: Boolean(callbacks.current.onSwipeRight),
  })

  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [settling, setSettling] = useState(false)
  const [armed, setArmed] = useState<SwipeDirection | null>(null)

  const reset = useCallback(() => {
    drag.current = null
    setDragging(false)
    setArmed(null)
    setSettling(!prefersReducedMotion())
    setOffset(0)
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    const allowed = allowedNow()
    if (!allowed.left && !allowed.right) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    // A drag that ended without producing a click mustn't eat the next tap.
    suppressClick.current = false
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: "undecided",
      width: (event.currentTarget as HTMLElement).offsetWidth || 320,
    }
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY

    if (current.axis === "undecided") {
      current.axis = classifyGesture(dx, dy)
      if (current.axis === "vertical") {
        // A scroll. Let it be.
        drag.current = null
        return
      }
      if (current.axis === "undecided") return
      try {
        ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      } catch {
        // Capture is a nicety; the drag still works without it.
      }
      setDragging(true)
      setSettling(false)
    }

    const next = resistedOffset(dx, allowedNow())
    const outcome = swipeOutcome(
      next,
      swipeThreshold(current.width),
      allowedNow()
    )
    setArmed((previous) => {
      if (outcome && outcome !== previous) void haptic("selection")
      return outcome
    })
    setOffset(next)
  }, [])

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId) return
      if (current.axis !== "horizontal") {
        drag.current = null
        return
      }

      // The pointerup of a drag still produces a click on the row.
      suppressClick.current = true
      const dx = event.clientX - current.startX
      const outcome = swipeOutcome(
        resistedOffset(dx, allowedNow()),
        swipeThreshold(current.width),
        allowedNow()
      )

      if (outcome === "left") {
        void haptic("medium")
        drag.current = null
        setDragging(false)
        setArmed(null)
        if (prefersReducedMotion()) {
          callbacks.current.onSwipeLeft?.()
          return
        }
        // Slide it the rest of the way out, then hide it.
        setSettling(true)
        setOffset(-current.width)
        window.setTimeout(() => callbacks.current.onSwipeLeft?.(), SETTLE_MS)
        return
      }

      reset()
      if (outcome === "right") {
        void haptic("medium")
        callbacks.current.onSwipeRight?.()
      }
    },
    [reset]
  )

  const onPointerCancel = useCallback(() => {
    if (drag.current) reset()
  }, [reset])

  const onClickCapture = useCallback((event: React.MouseEvent) => {
    if (!suppressClick.current) return
    suppressClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const style: React.CSSProperties = {
    transform: offset ? `translate3d(${offset}px, 0, 0)` : undefined,
    transition:
      settling && !dragging
        ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`
        : undefined,
    touchAction: "pan-y",
  }

  return {
    offset,
    dragging,
    armed,
    style,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
    },
  }
}
