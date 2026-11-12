"use client"

// Take D, "radar", the wildcard: a slow sweep turns around the person's dot,
// over faint 200 / 400 / 600 m rings. Every spot in range is a small dot; as
// the sweep passes one it pops up as an idea pin with its name for a moment,
// then settles back. The map feels alive and says "there's more around you
// than you think". Tap a popped pin to light it. Reduced motion: no sweep;
// every spot is a pin, and the nearest one carries its name.

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { at, atPx, SCALE, SpotPin, UserDot, type TakeProps } from "./_shared"
import { formatMeters, SPOTS, type NearSpot } from "./_spots"

const RANGE_M = 600
const TURN_MS = 7000
const SHOW_MS = 2300
const RINGS_M = [200, 400, 600]
const IN_RANGE = SPOTS.filter((s) => s.meters <= RANGE_M)

export function TakeD({ still, onLight }: TakeProps) {
  const [{ angle, now }, setFrame] = useState({ angle: 0, now: 0 })
  const [lit, setLit] = useState<Record<string, number>>({})
  const prev = useRef(0)

  useEffect(() => {
    if (still) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      // rAF's timestamp can be a hair before `start` on the first frame.
      const a = ((Math.max(0, now - start) / TURN_MS) * 360) % 360
      const from = prev.current
      prev.current = a
      setFrame({ angle: a, now })
      // Spots whose bearing the sweep crossed since the last frame light up.
      const crossed = IN_RANGE.filter((s) =>
        from <= a
          ? s.bearing > from && s.bearing <= a
          : s.bearing > from || s.bearing <= a
      )
      if (crossed.length > 0) {
        setLit((l) => {
          const next = { ...l }
          for (const s of crossed) next[s.id] = now
          return next
        })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [still])

  const isLit = (s: NearSpot) =>
    still || now - (lit[s.id] ?? -Infinity) < SHOW_MS
  const named = still ? IN_RANGE[0]?.id : undefined
  const sweepPx = RANGE_M * SCALE

  return (
    <>
      {RINGS_M.map((m) => (
        <div key={m}>
          <span
            style={{
              ...atPx(0, 0),
              width: m * SCALE * 2,
              height: m * SCALE * 2,
            }}
            className="absolute rounded-full border border-primary/25"
          />
          <span
            style={atPx(0, -m * SCALE - 8)}
            className="absolute text-xs text-muted-foreground"
          >
            {m} m
          </span>
        </div>
      ))}

      {!still && (
        <span
          aria-hidden="true"
          style={{
            ...atPx(0, 0),
            width: sweepPx * 2,
            height: sweepPx * 2,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            background:
              "conic-gradient(from -50deg, transparent 0deg, color-mix(in oklch, var(--primary) 28%, transparent) 50deg, transparent 50.5deg)",
          }}
          className="pointer-events-none absolute rounded-full"
        />
      )}

      {IN_RANGE.map((spot) =>
        isLit(spot) ? (
          <div key={spot.id}>
            <SpotPin
              spot={spot}
              active
              onClick={() => onLight(spot)}
              style={{ ...at(spot) }}
            />
            {(!still || spot.id === named) && (
              <span
                style={{ ...at(spot), transform: "translate(-50%, 24px)" }}
                className={cn(
                  "absolute z-20 w-max rounded-full bg-card px-2 py-0.5 text-xs font-medium shadow-sm",
                  !still && "animate-in duration-200 fade-in"
                )}
              >
                {spot.title} · {formatMeters(spot.meters)}
              </span>
            )}
          </div>
        ) : (
          <span
            key={spot.id}
            style={at(spot)}
            className="absolute size-2 rounded-full bg-primary/50"
          />
        )
      )}

      <UserDot />
    </>
  )
}
