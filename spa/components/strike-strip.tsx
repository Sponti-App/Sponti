"use client"

// The strike strip (#376, behind `flareLightMoment`): the composer's way to
// light a flare. Flick the flame knob along the strip like striking a match.
// It is never the only way: a plain tap lights it too, and so do Enter and
// Space (the strip is a real button, so screen readers and switch control
// activate it as one). Only a drag that is too slow or too short fizzles, with
// a "swipe faster" hint, so a half-hearted swipe never lights by accident.
//
// The nav's round flare button morphs into this strip when the composer opens
// and back when it closes (lib/motion/morph.ts); STRIP_KNOB is the geometry
// the morph needs.

import { forwardRef, useRef, useState } from "react"
import { FlameIcon } from "@/components/icons"
import { haptic } from "@/lib/haptics"
import { judgeStrike } from "@/lib/motion/lighting"
import { cn } from "@/lib/utils"

/** The knob's inset from the strip's edge and its diameter, in px. */
export const STRIP_KNOB = { inset: 4, size: 48 } as const

const FIZZLE_HINT_MS = 1600
/** A second activation this soon after one is the same press (tap + click). */
const REPEAT_GUARD_MS = 600

export const StrikeStrip = forwardRef<
  HTMLButtonElement,
  {
    label: string
    disabled?: boolean
    /** The flare is being created: the knob glows and the strip waits. */
    busy?: boolean
    /** Hidden while the morph's clone stands in for it. */
    concealed?: boolean
    onLight: () => void
  }
>(function StrikeStrip(
  { label, disabled = false, busy = false, concealed = false, onLight },
  ref
) {
  const start = useRef<{ x: number; t: number } | null>(null)
  const xNow = useRef(0)
  const lastFire = useRef(0)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [fizzled, setFizzled] = useState(false)
  const fizzleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ready = !disabled && !busy

  const range = (el: HTMLElement) =>
    Math.max(1, el.clientWidth - STRIP_KNOB.size - STRIP_KNOB.inset * 2)

  const fire = () => {
    const now = performance.now()
    if (now - lastFire.current < REPEAT_GUARD_MS) return
    lastFire.current = now
    haptic("medium")
    onLight()
  }

  const fizzle = () => {
    haptic("light")
    setFizzled(true)
    if (fizzleTimer.current) clearTimeout(fizzleTimer.current)
    fizzleTimer.current = setTimeout(() => setFizzled(false), FIZZLE_HINT_MS)
  }

  const end = (el: HTMLElement, cancelled: boolean) => {
    const s = start.current
    start.current = null
    setDragging(false)
    const travelled = xNow.current
    xNow.current = 0
    setX(0)
    if (!s || cancelled) return
    const verdict = judgeStrike({
      travelled,
      range: range(el),
      elapsedMs: performance.now() - s.t,
    })
    if (verdict === "fizzle") fizzle()
    else fire()
  }

  return (
    <button
      ref={ref}
      type="button"
      data-strike-strip
      data-testid="strike-to-light"
      disabled={disabled}
      aria-busy={busy || undefined}
      onPointerDown={(e) => {
        if (!ready || e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, t: performance.now() }
        setDragging(true)
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s) return
        xNow.current = Math.max(
          0,
          Math.min(range(e.currentTarget), e.clientX - s.x)
        )
        setX(xNow.current)
      }}
      onPointerUp={(e) => end(e.currentTarget, false)}
      onPointerCancel={(e) => end(e.currentTarget, true)}
      onClick={(e) => {
        // Pointer presses are handled above. A click with no pointer behind
        // it (Enter, Space, a screen reader, switch control) lights it.
        if (e.detail === 0 && ready) fire()
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative h-14 w-full touch-none overflow-hidden rounded-full bg-muted select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
        concealed && "opacity-0"
      )}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
    >
      {/* The streak the match head leaves behind. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full"
        style={{
          width: x + STRIP_KNOB.size,
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 45%, transparent))",
          opacity: dragging ? 1 : 0,
        }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center pl-10 text-sm font-medium text-muted-foreground"
        aria-live="polite"
      >
        {busy ? "lighting…" : fizzled ? "swipe faster" : label}
      </span>
      <span
        aria-hidden
        data-strike-knob
        className={cn(
          "absolute top-1 left-1 flex items-center justify-center rounded-full bg-accent text-accent-foreground",
          !dragging && "transition-transform duration-300 ease-out",
          busy && "motion-safe:animate-pulse"
        )}
        style={{
          width: STRIP_KNOB.size,
          height: STRIP_KNOB.size,
          transform: `translateX(${x}px)`,
        }}
      >
        <FlameIcon className="size-6" />
      </span>
    </button>
  )
})
