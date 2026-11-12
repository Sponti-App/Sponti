"use client"

// Take C, "spotlight": one idea at a time, in a callout that hangs off the
// person's dot, with a dotted path to the real spot, which grows and glows.
// Every few seconds the next-nearest idea takes over; the other pins stay
// small and faint. Arrows and dots let you flip through by hand, which stops
// the cycling. Reduced motion: the callout swaps in place, no fades.

import { useEffect, useState } from "react"
import { ArrowRightIcon } from "@/components/icons"
import { IdeaIcon } from "@/components/idea-icon"
import { cn } from "@/lib/utils"
import { atPx, pointPx, SpotPin, UserDot, type TakeProps } from "./_shared"
import { formatMeters, SPOTS } from "./_spots"

const COUNT = 5
const STEP_MS = 4000
const NEAR = SPOTS.slice(0, COUNT)

export function TakeC({ still, onLight }: TakeProps) {
  const [index, setIndex] = useState(0)
  const [manual, setManual] = useState(false)
  const spot = NEAR[index]
  const target = pointPx(spot)

  useEffect(() => {
    if (manual) return
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % NEAR.length),
      STEP_MS
    )
    return () => window.clearInterval(id)
  }, [manual])

  return (
    <>
      {/* A zero-size svg on the dot: the path runs from 0,0 to the spot. */}
      <svg
        aria-hidden="true"
        style={{ ...atPx(0, 0), transform: "none" }}
        className="pointer-events-none absolute size-0 overflow-visible"
      >
        <line
          x1={0}
          y1={0}
          x2={target.x}
          y2={target.y}
          className="stroke-primary"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
      </svg>

      {SPOTS.filter((s) => s.meters <= 700).map((s) => (
        <SpotPin
          key={s.id}
          spot={s}
          size={s.id === spot.id ? "lg" : "sm"}
          active={s.id === spot.id}
          dim={s.id !== spot.id}
          onClick={() => {
            const i = NEAR.findIndex((n) => n.id === s.id)
            if (i >= 0) {
              setIndex(i)
              setManual(true)
            }
          }}
        />
      ))}

      <UserDot pulse={!still} />

      {/* The callout hangs off the dot on the side away from the spot, so it
          never covers the spot or the path. */}
      <div
        style={{
          ...atPx(0, target.y > 0 ? -34 : 34),
          transform: `translate(-50%, ${target.y > 0 ? "-100%" : "0"})`,
        }}
        className="absolute z-30 w-[260px]"
      >
        <div
          key={spot.id}
          className={cn(
            "flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-2.5 shadow-md",
            !still && "animate-in duration-300 fade-in slide-in-from-bottom-1"
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-foreground">
            <IdeaIcon
              idea={{ icon: spot.icon, category: "hangout" }}
              className="size-5"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{spot.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatMeters(spot.meters)} · {spot.place}
            </p>
          </div>
          <button
            type="button"
            aria-label={`light ${spot.title}`}
            onClick={() => onLight(spot)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <ArrowRightIcon className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {NEAR.map((n, i) => (
            <button
              key={n.id}
              type="button"
              aria-label={n.title}
              onClick={() => {
                setIndex(i)
                setManual(true)
              }}
              className={cn(
                "h-1.5 rounded-full transition-[width]",
                i === index ? "w-4 bg-primary" : "w-1.5 bg-foreground/20"
              )}
            />
          ))}
        </div>
      </div>
    </>
  )
}
