"use client"

// Take B, "compass ring": the nearest six ideas sit on a ring right around the
// person's dot, each in the true direction of its spot, so the first screen
// reads "things you could do right here". A highlight steps round the ring
// every few seconds and names one idea; the spot itself is a small dot at its
// real place. Tapping a bubble picks it and stops the stepping.
// Reduced motion: the highlight still steps, but swaps in place.

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { at, atPx, SpotPin, UserDot, type TakeProps } from "./_shared"
import { formatMeters, SPOTS, type NearSpot } from "./_spots"

const RING_PX = 84
const COUNT = 6
const MIN_GAP_DEG = 44
const STEP_MS = 2800
/** How far off centre a name may sit and still fit a 390px frame, for the
 * longest title (about 240px). */
const LABEL_REACH = 60

/** Bearings nudged apart so no two bubbles overlap, order kept: neighbours
 * closer than MIN_GAP_DEG push each other apart, half each, until they settle
 * (6 × 44° fits in a circle, so they always do). */
function spread(spots: NearSpot[]) {
  const sorted = [...spots].sort((a, b) => a.bearing - b.bearing)
  const angles = sorted.map((s) => s.bearing)
  const n = angles.length
  for (let pass = 0; pass < 200; pass++) {
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n
      let gap = angles[next] - angles[i]
      if (next === 0) gap += 360
      if (gap < MIN_GAP_DEG) {
        const push = (MIN_GAP_DEG - gap) / 2
        angles[i] -= push
        angles[next] += push
      }
    }
  }
  return sorted.map((spot, i) => ({ spot, angle: (angles[i] + 360) % 360 }))
}

const PLACED = spread(SPOTS.slice(0, COUNT))

export function TakeB({ still, onLight }: TakeProps) {
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const current = picked ?? step % PLACED.length

  useEffect(() => {
    if (picked !== null) return
    const id = window.setInterval(() => setStep((s) => s + 1), STEP_MS)
    return () => window.clearInterval(id)
  }, [picked])

  const active = PLACED[current]
  const rad = (active.angle * Math.PI) / 180

  return (
    <>
      {/* The real spots, small and quiet. */}
      {PLACED.map(({ spot }) => (
        <span
          key={`dot-${spot.id}`}
          style={at(spot)}
          className={cn(
            "absolute size-2 rounded-full bg-primary/60 transition-transform",
            spot.id === active.spot.id && "scale-150 bg-primary"
          )}
        />
      ))}

      <span
        style={{ ...atPx(0, 0), width: RING_PX * 2, height: RING_PX * 2 }}
        className="absolute rounded-full border border-dashed border-primary/40"
      />

      {PLACED.map(({ spot, angle }, i) => {
        const r = (angle * Math.PI) / 180
        const x = Math.sin(r) * RING_PX
        const y = -Math.cos(r) * RING_PX
        return (
          <SpotPin
            key={spot.id}
            spot={spot}
            size={i === current ? "lg" : "md"}
            active={i === current}
            style={{
              ...atPx(x, y),
              transition: still ? "none" : undefined,
            }}
            onClick={() => setPicked(i === picked ? null : i)}
          />
        )
      })}

      <UserDot />

      {/* The name sits just outside the ring, above it for a bubble in the
          top half and below it for one in the bottom half, so it never covers
          a bubble, and held inside the frame's width. */}
      <button
        type="button"
        key={active.spot.id}
        onClick={() => onLight(active.spot)}
        style={{
          ...atPx(
            Math.max(
              -LABEL_REACH,
              Math.min(LABEL_REACH, Math.sin(rad) * RING_PX)
            ),
            Math.cos(rad) > 0 ? -RING_PX - 34 : RING_PX + 34
          ),
          transform: `translate(-50%, ${Math.cos(rad) > 0 ? "-100%" : "0"})`,
        }}
        className={cn(
          "absolute z-30 w-max rounded-full border border-border/60 bg-card px-3 py-1.5 text-left shadow-md",
          !still && "animate-in duration-300 fade-in"
        )}
      >
        <span className="text-sm font-semibold">{active.spot.title}</span>
        <span className="ml-1.5 text-xs text-muted-foreground">
          {formatMeters(active.spot.meters)}
        </span>
      </button>
    </>
  )
}
