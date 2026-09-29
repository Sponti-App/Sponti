"use client"

// PROTOTYPE (#223): variant O, "today". A faithful copy of the geometry and
// gesture model of the current sheet in components/map-view.tsx, so the bugs
// can be reproduced next to the fixes (turn on "safari fullscreen" in the bar).
//
//   - The sheet is `absolute` inside the page's `min-h-dvh` box, while the nav
//     is `position: fixed`: two coordinate systems.
//   - mini sits at bottom: var(--sponti-nav-h); peek (268px) and expanded (55vh)
//     sit at bottom: 0, i.e. behind/under the nav. Expanded is z-50 > nav z-40.
//   - Only the 44px handle drags (pointer up only, no live follow). The list
//     is `overflow-y-auto` at every height.
//
// Prototype snap names map to today's: peek → "mini", mid → "peek", full → "expanded".

import { useRef } from "react"
import { ChevronUp, Flame } from "lucide-react"
import { FlareRow, SheetHeading, TimeTabs, TypeChips, type VariantProps } from "./_shared"

const SHEET_PX = { mini: 64, peek: 268 } as const
const NAV = "var(--sponti-nav-h, 64px)"

export function VariantO({
  snap,
  onSnap,
  tab,
  onTab,
  types,
  onToggleType,
  onClearTypes,
  flares,
  onCta,
  onOpenFlare,
}: VariantProps) {
  const startY = useRef<number | null>(null)
  const startT = useRef(0)

  const sheetStyle: React.CSSProperties =
    snap === "full"
      ? { height: "55vh", bottom: 0 }
      : snap === "peek"
        ? { height: `${SHEET_PX.mini}px`, bottom: NAV }
        : { height: `${SHEET_PX.peek}px`, bottom: 0 }
  const fabStyle: React.CSSProperties =
    snap === "peek"
      ? { bottom: `calc(${NAV} + ${SHEET_PX.mini + 12}px)` }
      : { bottom: `${SHEET_PX.peek + 12}px` }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY
    startT.current = performance.now()
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return
    const delta = e.clientY - startY.current
    const v = Math.abs(delta) / Math.max(performance.now() - startT.current, 1)
    startY.current = null
    const flick = v > 0.4
    if (delta > 50 || (flick && delta > 0)) {
      if (snap === "full") onSnap("mid")
      else if (snap === "mid") onSnap("peek")
    } else if (delta < -50 || (flick && delta < 0)) {
      if (snap === "peek") onSnap("mid")
      else if (snap === "mid") onSnap("full")
    }
  }

  return (
    // Same box as app/page.tsx: min-h-dvh inside a body padded by the safe areas.
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <button
          type="button"
          onClick={() => onCta(null)}
          style={fabStyle}
          aria-label="light a flare"
          className="absolute right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-[bottom] duration-300 ease-out"
        >
          <Flame className="h-6 w-6" />
        </button>

        <div
          style={sheetStyle}
          className={`absolute right-0 left-0 rounded-t-3xl bg-background shadow-(--shadow-sheet) transition-all duration-300 ease-out ${snap === "full" ? "z-50" : "z-20"}`}
        >
          <div
            className="flex cursor-grab touch-none justify-center py-3"
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          {snap === "peek" ? (
            <button
              type="button"
              onClick={() => onSnap("mid")}
              className="flex h-[calc(100%-44px)] w-full items-center justify-center gap-2 px-4 text-sm font-medium text-muted-foreground"
            >
              <ChevronUp className="h-5 w-5" />
              {flares.length} flares nearby
            </button>
          ) : (
            <div className={`h-[calc(100%-44px)] overflow-y-auto px-4 ${snap === "full" ? "pb-8" : "pb-24"}`}>
              <div className="mb-3">
                <SheetHeading count={flares.length} />
              </div>
              <div className="mb-3 space-y-2">
                <TimeTabs tab={tab} onTab={onTab} />
                <TypeChips types={types} onToggleType={onToggleType} onClearTypes={onClearTypes} />
              </div>
              <div className="space-y-2">
                {flares.map((f) => (
                  <FlareRow key={f.id} flare={f} onClick={() => onOpenFlare(f)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
