"use client"

// PROTOTYPE (#371) — throwaway. Gesture B: strike to light. A quick swipe
// along the strip, like striking a match. Fast and far enough lights the
// fuse, which then burns on its own; a slow drag fizzles. Enter or space
// strikes from a keyboard.

import { useRef, useState } from "react"
import { FlameIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import type { FlareMoment } from "./_stage"

/** Share of the strip a strike must cover. */
const MIN_DISTANCE = 0.6
/** Average speed a strike needs, in px per ms (about a flick). */
const MIN_SPEED = 0.45
const KNOB = 48

export function StrikeVariant({ moment }: { moment: FlareMoment }) {
  const { phase } = moment
  const track = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; t: number } | null>(null)
  const [x, setX] = useState(0)
  // The latest offset, read on pointer up (state may lag a fast flick).
  const xNow = useRef(0)
  const [dragging, setDragging] = useState(false)
  const ready = phase === "idle" || phase === "failed"

  const max = () => (track.current?.clientWidth ?? 300) - KNOB - 8

  const end = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s) return
    const travelled = xNow.current
    xNow.current = 0
    const elapsed = Math.max(1, performance.now() - s.t)
    const ok =
      travelled / max() >= MIN_DISTANCE && travelled / elapsed >= MIN_SPEED
    setX(0)
    void moment.strike(ok)
  }

  const label =
    phase === "burning"
      ? "burning…"
      : phase === "waiting"
        ? "lighting…"
        : ready
          ? "swipe to strike"
          : "lit"

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
          void moment.strike(true)
        }
      }}
      className={cn(
        "relative h-14 w-full touch-none overflow-hidden rounded-full bg-muted select-none",
        !ready && "opacity-60"
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
          !dragging && "transition-transform duration-300 ease-out"
        )}
        style={{
          width: KNOB,
          height: KNOB,
          transform: `translateX(${x}px)`,
        }}
      >
        <FlameIcon className="size-6" />
      </span>
    </div>
  )
}
