"use client"

// PROTOTYPE (#223): variant A, "anchored custom sheet".
//
// Keeps a hand-rolled sheet, but fixes the geometry at the root:
//   - One fixed "stage" whose bottom IS the nav's top (bottom: var(--sponti-nav-h))
//     and whose top clears the header chips. The sheet lives inside it, so it
//     can't gap from the nav or cover it: no arithmetic, same coordinate
//     system as the nav (both position: fixed to the viewport).
//   - The sheet is always stage-height and moves with translateY only (no
//     height animation). Peek = header + filters, mid = half the stage,
//     full = the whole stage.
//   - The whole sheet drags at peek and mid; the list is overflow: hidden
//     there. Only at full does the list scroll, and pulling down from the top
//     of the list hands the gesture back to the sheet (iOS Maps style).
//   - The finger is followed live, with rubber-banding past the ends and a
//     velocity projection to pick the snap, on vaul's easing curve.
//   - The type-aware CTA is the FAB itself: it grows into "light a drinks
//     flare" when exactly one type filter is on, and rides the sheet's top.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronUp, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { ctaFor, typeInfo, type Snap } from "./_mock"
import {
  EmptyList,
  FlareRow,
  ListCta,
  SHEET_EASE,
  SHEET_MS,
  SheetHeading,
  TOP_RESERVED_CSS,
  TimeTabs,
  TypeChips,
  type VariantProps,
} from "./_shared"

const ORDER: Snap[] = ["full", "mid", "peek"]

function rubber(overshoot: number) {
  // Diminishing returns past the ends, like UIScrollView.
  return (1 - 1 / (overshoot * 0.55 / 120 + 1)) * 120
}

type Drag = {
  startY: number
  startT: number
  lastY: number
  lastTime: number
  v: number
  mode: "pending" | "drag" | "scroll"
  moved: boolean
  /** Current translate while dragging. */
  t: number
}

export function VariantA(props: VariantProps) {
  const { snap, onSnap, tab, onTab, types, onToggleType, onClearTypes, flares, onCta, onOpenFlare } = props
  const stageRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [stageH, setStageH] = useState(0)
  const [peekH, setPeekH] = useState(150)
  const [live, setLive] = useState<number | null>(null)
  const drag = useRef<Drag | null>(null)
  const swallowClick = useRef(false)

  useLayoutEffect(() => {
    const measure = () => {
      if (stageRef.current) setStageH(stageRef.current.clientHeight)
      if (headRef.current) setPeekH(headRef.current.offsetTop + headRef.current.offsetHeight + 4)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (stageRef.current) ro.observe(stageRef.current)
    if (headRef.current) ro.observe(headRef.current)
    return () => ro.disconnect()
  }, [])

  const translateFor = useCallback(
    (s: Snap) => {
      const visible = s === "full" ? stageH : s === "mid" ? Math.round(stageH * 0.5) : peekH
      return Math.max(0, stageH - visible)
    },
    [stageH, peekH]
  )
  const base = translateFor(snap)
  const translate = live ?? base
  const maxT = translateFor("peek")

  // Scroll back to the top whenever the sheet leaves full, so the list is
  // always read from the top at mid ("shows what fits").
  useEffect(() => {
    if (snap !== "full" && listRef.current) listRef.current.scrollTop = 0
  }, [snap])

  // Gesture handling. Touch uses native listeners so touchmove can be
  // cancelled (passive: false); mouse uses pointer events.
  const start = useCallback(
    (y: number) => {
      drag.current = { startY: y, startT: base, lastY: y, lastTime: performance.now(), v: 0, mode: "pending", moved: false, t: base }
    },
    [base]
  )

  const move = useCallback(
    (y: number): boolean => {
      const d = drag.current
      if (!d) return false
      const dy = y - d.startY
      if (d.mode === "pending") {
        if (Math.abs(dy) < 3) return false
        if (snap !== "full") d.mode = "drag"
        else if ((listRef.current?.scrollTop ?? 0) <= 0 && dy > 0) d.mode = "drag"
        else d.mode = "scroll"
      }
      if (d.mode !== "drag") return false
      d.moved = true
      const now = performance.now()
      const dt = Math.max(now - d.lastTime, 1)
      d.v = 0.8 * ((y - d.lastY) / dt) + 0.2 * d.v
      d.lastY = y
      d.lastTime = now
      let t = d.startT + dy
      if (t < 0) t = -rubber(-t)
      if (t > maxT) t = maxT + rubber(t - maxT)
      d.t = t
      setLive(t)
      return true
    },
    [snap, maxT]
  )

  const end = useCallback(() => {
    const d = drag.current
    drag.current = null
    if (!d || d.mode !== "drag") {
      setLive(null)
      return
    }
    swallowClick.current = d.moved
    // Project where a flick would carry the sheet, then take the nearest snap.
    const projected = d.t + d.v * 220
    let best: Snap = snap
    let bestDist = Infinity
    for (const s of ORDER) {
      const dist = Math.abs(translateFor(s) - projected)
      if (dist < bestDist) {
        best = s
        bestDist = dist
      }
    }
    setLive(null)
    if (best !== snap) onSnap(best)
  }, [snap, onSnap, translateFor])

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const ts = (e: TouchEvent) => start(e.touches[0].clientY)
    const tm = (e: TouchEvent) => {
      if (move(e.touches[0].clientY) && e.cancelable) e.preventDefault()
    }
    const te = () => end()
    el.addEventListener("touchstart", ts, { passive: true })
    el.addEventListener("touchmove", tm, { passive: false })
    el.addEventListener("touchend", te)
    el.addEventListener("touchcancel", te)
    return () => {
      el.removeEventListener("touchstart", ts)
      el.removeEventListener("touchmove", tm)
      el.removeEventListener("touchend", te)
      el.removeEventListener("touchcancel", te)
    }
  }, [start, move, end])

  const cta = ctaFor(types)
  const CtaIcon = cta.type ? typeInfo(cta.type).icon : Flame
  const dragging = live !== null

  return (
    <div
      ref={stageRef}
      className="pointer-events-none fixed inset-x-0 z-20 overflow-hidden"
      style={{ top: TOP_RESERVED_CSS, bottom: "var(--sponti-nav-h, 64px)" }}
    >
      <div
        ref={sheetRef}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return
          start(e.clientY)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") move(e.clientY)
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") end()
        }}
        onClickCapture={(e) => {
          if (swallowClick.current) {
            swallowClick.current = false
            e.stopPropagation()
            e.preventDefault()
          }
        }}
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-full flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) select-none"
        style={{
          transform: `translate3d(0, ${translate}px, 0)`,
          transition: dragging ? "none" : `transform ${SHEET_MS}ms ${SHEET_EASE}`,
          touchAction: snap === "full" ? "pan-y" : "none",
        }}
      >
        {/* FAB rides the sheet's top edge; grows into the type-aware CTA. */}
        <div
          className={cn(
            "absolute right-4 bottom-full mb-3 transition-opacity duration-200",
            snap === "full" && !dragging ? "pointer-events-none opacity-0" : "opacity-100"
          )}
        >
          <button
            type="button"
            onClick={() => onCta(cta.type)}
            aria-label={cta.label}
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-full bg-accent text-accent-foreground shadow-lg transition-[width,padding] duration-300 active:scale-95",
              cta.type ? "px-5" : "w-14"
            )}
          >
            <CtaIcon className="h-6 w-6 shrink-0" />
            {cta.type && <span className="text-sm font-semibold whitespace-nowrap">{cta.label}</span>}
          </button>
        </div>

        <div className="flex shrink-0 cursor-grab justify-center pt-2.5 pb-2">
          <div className="h-1.5 w-10 rounded-full bg-border" />
        </div>

        <div ref={headRef} className="shrink-0 space-y-2 px-4 pb-2">
          <SheetHeading count={flares.length} />
          <TimeTabs tab={tab} onTab={onTab} />
          <TypeChips types={types} onToggleType={onToggleType} onClearTypes={onClearTypes} />
        </div>

        <div
          ref={listRef}
          className={cn(
            "min-h-0 flex-1 overscroll-contain px-4 pt-1",
            snap === "full" && !dragging ? "overflow-y-auto" : "overflow-hidden"
          )}
        >
          {flares.length === 0 ? (
            <EmptyList types={types} onCta={onCta} />
          ) : (
            <div className="space-y-2 pb-4">
              {flares.map((f) => (
                <FlareRow key={f.id} flare={f} onClick={() => onOpenFlare(f)} />
              ))}
              <div className="pt-2">
                <ListCta types={types} onCta={onCta} loud={snap === "full"} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* At mid, the list is cut at the nav: a fade + "see all" says there is more. */}
      {snap === "mid" && !dragging && flares.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent pb-2">
          <button
            type="button"
            onClick={() => onSnap("full")}
            className="pointer-events-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            see all {flares.length}
          </button>
        </div>
      )}
    </div>
  )
}
