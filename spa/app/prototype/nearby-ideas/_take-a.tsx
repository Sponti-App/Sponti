"use client"

// Take A, "at the spot": the safe one. Idea pins move from whole parks to the
// actual table, wall or court, and only what's within a short walk shows.
// The nearest three carry their distance. Tapping a pin opens a small card on
// it. No motion beyond the card popping in.

import { useState } from "react"
import { cn } from "@/lib/utils"
import { at, SpotPin, UserDot, type TakeProps } from "./_shared"
import { formatMeters, SPOTS } from "./_spots"

const WALK_M = 600

export function TakeA({ still, onLight }: TakeProps) {
  const near = SPOTS.filter((s) => s.meters <= WALK_M)
  const [openId, setOpenId] = useState<string | null>("pingpong-north")
  const open = near.find((s) => s.id === openId) ?? null

  return (
    <>
      {near.map((spot, i) => (
        <div key={spot.id}>
          <SpotPin
            spot={spot}
            active={spot.id === openId}
            onClick={() => setOpenId(spot.id === openId ? null : spot.id)}
          />
          {i < 3 && spot.id !== openId && (
            <span
              style={{ ...at(spot), transform: "translate(-50%, 22px)" }}
              className="absolute rounded-full bg-background/90 px-1.5 text-xs text-muted-foreground"
            >
              {formatMeters(spot.meters)}
            </span>
          )}
        </div>
      ))}
      <UserDot />

      {open && (
        <div
          key={open.id}
          style={{
            ...at(open),
            transform: "translate(-50%, 26px)",
          }}
          className={cn(
            "absolute z-30 flex w-max max-w-[240px] items-center gap-3 rounded-2xl border border-border/60 bg-card py-2 pr-2 pl-3.5 shadow-md",
            !still && "animate-in duration-200 zoom-in-95 fade-in"
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">{open.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatMeters(open.meters)} · {open.place}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLight(open)}
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            light it
          </button>
        </div>
      )}
    </>
  )
}
