"use client"

// PROTOTYPE (#371, round 2) — throwaway. The strike swipe Patrick kept from
// round 1 (#405): flick the flame along the strip like striking a match.
// Far and fast enough lights the fuse; a slow drag fizzles. Enter or space
// strikes from a keyboard.

import { useRef, useState } from "react"
import { FlameIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/** Share of the strip a strike must cover. */
const MIN_DISTANCE = 0.6
/** Average speed a strike needs, in px per ms (about a flick). */
const MIN_SPEED = 0.45
const KNOB = 48

export function StrikeStrip({
  ready,
  label,
  onStart,
  onStrike,
}: {
  ready: boolean
  label: string
  /** A strike began: the moment's code starts loading now. */
  onStart: () => void
  onStrike: (ok: boolean) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; t: number } | null>(null)
  const xNow = useRef(0)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const max = () => (track.current?.clientWidth ?? 300) - KNOB - 8

  const end = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s) return
    const travelled = xNow.current
    xNow.current = 0
    setX(0)
    const elapsed = Math.max(1, performance.now() - s.t)
    onStrike(
      travelled / max() >= MIN_DISTANCE && travelled / elapsed >= MIN_SPEED
    )
  }

  return (
    <div
      ref={track}
      role="button"
      tabIndex={ready ? 0 : -1}
      aria-disabled={!ready}
      aria-label="strike to light"
      data-testid="strike-to-light"
      onPointerDown={(e) => {
        if (!ready) return
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, t: performance.now() }
        setDragging(true)
        onStart()
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s) return
        xNow.current = Math.max(0, Math.min(max(), e.clientX - s.x))
        setX(xNow.current)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat && ready) {
          e.preventDefault()
          onStart()
          onStrike(true)
        }
      }}
      className={cn(
        "relative h-14 w-full touch-none overflow-hidden rounded-full bg-muted select-none",
        !ready && "opacity-50"
      )}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
    >
      {/* The streak the match head leaves behind. */}
      <div
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full"
        style={{
          width: x + KNOB,
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 45%, transparent))",
          opacity: dragging ? 1 : 0,
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center pl-10 text-sm text-muted-foreground">
        {label}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute top-1 left-1 flex items-center justify-center rounded-full bg-accent text-accent-foreground",
          !dragging && "transition-transform duration-300 ease-out",
          !ready && "bg-card text-muted-foreground"
        )}
        style={{ width: KNOB, height: KNOB, transform: `translateX(${x}px)` }}
      >
        <FlameIcon className="size-6" />
      </span>
    </div>
  )
}
