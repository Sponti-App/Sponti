"use client"

// PROTOTYPE (#223): variant C, "cards + list toggle". No sheet at all.
//
//   - peek: a floating filter bar docked on the nav, plus the FAB (which
//     turns into "light a drinks flare" when one type is on).
//   - mid: a horizontal, scroll-snapping card carousel above the filter bar.
//     The centred card's pin grows on the map. The last card is the
//     type-aware CTA.
//   - full: a plain full-height list page (top chips → nav), toggled by the
//     "list" / "map" button. It scrolls natively; nothing to drag.
//
// Everything is docked with bottom: var(--sponti-nav-h), same coordinate
// system as the nav. A vertical swipe on the dock steps peek ↔ mid ↔ full,
// but buttons do all the work, so there's no drag physics to get wrong.

import { useEffect, useRef } from "react"
import { ChevronDown, Flame, List, Map as MapIcon, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { ctaFor, isLive, metaLine, typeInfo, type MockFlare } from "./_mock"
import {
  EmptyList,
  FlareRow,
  ListCta,
  TOP_RESERVED_CSS,
  TimeTabs,
  TypeChips,
  type VariantProps,
} from "./_shared"

export function VariantC({
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
  onHighlight,
}: VariantProps & { onHighlight: (id: string | null) => void }) {
  const railRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const cta = ctaFor(types)
  const CtaIcon = cta.type ? typeInfo(cta.type).icon : Flame

  // Highlight the pin of the card nearest the rail's centre.
  const syncHighlight = () => {
    const rail = railRef.current
    if (!rail) return
    const centre = rail.scrollLeft + rail.clientWidth / 2
    let best: string | null = null
    let bestDist = Infinity
    for (const child of Array.from(rail.children) as HTMLElement[]) {
      const id = child.dataset.flare
      if (!id) continue
      const d = Math.abs(child.offsetLeft + child.offsetWidth / 2 - centre)
      if (d < bestDist) {
        bestDist = d
        best = id
      }
    }
    onHighlight(best)
  }
  useEffect(() => {
    if (snap === "mid") syncHighlight()
    else onHighlight(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, flares])

  const onTouchStart = (e: React.TouchEvent) => {
    swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return
    if (dy < 0) onSnap(snap === "peek" ? "mid" : "full")
    else if (snap === "mid") onSnap("peek")
  }

  return (
    <>
      {/* dock: sits on the nav */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-20 flex flex-col gap-2 pb-2 transition-opacity duration-200",
          snap === "full" && "opacity-0"
        )}
        style={{ bottom: "var(--sponti-nav-h, 64px)" }}
      >
        {/* FAB / type-aware CTA at peek */}
        {snap === "peek" && (
          <div className="flex justify-end px-4">
            <button
              type="button"
              onClick={() => onCta(cta.type)}
              aria-label={cta.label}
              className={cn(
                "pointer-events-auto flex h-14 items-center justify-center gap-2 rounded-full bg-accent text-accent-foreground shadow-lg active:scale-95",
                cta.type ? "px-5" : "w-14"
              )}
            >
              <CtaIcon className="h-6 w-6 shrink-0" />
              {cta.type && <span className="text-sm font-semibold whitespace-nowrap">{cta.label}</span>}
            </button>
          </div>
        )}

        {/* card rail */}
        {snap === "mid" && (
          <div
            ref={railRef}
            onScroll={syncHighlight}
            className="scrollbar-none pointer-events-auto flex touch-pan-x snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pt-1 pb-1"
          >
            {flares.map((f) => (
              <RailCard key={f.id} flare={f} onClick={() => onOpenFlare(f)} />
            ))}
            <div data-flare="cta" className="flex w-[78%] shrink-0 snap-center flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-(--shadow-card)">
              <div>
                <p className="text-base font-semibold">
                  {cta.type ? `up for ${typeInfo(cta.type).label}?` : "nothing you fancy?"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">start one and your circles will see it</p>
              </div>
              <button
                type="button"
                onClick={() => onCta(cta.type)}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground active:scale-[0.98]"
              >
                <CtaIcon className="h-4 w-4" />
                {cta.label}
              </button>
            </div>
          </div>
        )}

        {/* filter bar */}
        <div className="pointer-events-auto mx-3 space-y-2 rounded-2xl border border-border/60 bg-background/90 p-2 shadow-(--shadow-card) backdrop-blur-md">
          <div className="flex items-center gap-2">
            <TimeTabs tab={tab} onTab={onTab} className="flex-1" />
            <button
              type="button"
              onClick={() => onSnap(snap === "mid" ? "peek" : "mid")}
              aria-label={snap === "mid" ? "hide cards" : "show cards"}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium"
            >
              {snap === "mid" ? <ChevronDown className="h-3.5 w-3.5" /> : <span>{flares.length}</span>}
              {snap === "mid" ? "hide" : "nearby"}
            </button>
            <button
              type="button"
              onClick={() => onSnap("full")}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-card px-2.5 text-xs font-medium text-primary"
            >
              <List className="h-3.5 w-3.5" />
              list
            </button>
          </div>
          <TypeChips types={types} onToggleType={onToggleType} onClearTypes={onClearTypes} className="mx-0 px-0" />
        </div>
      </div>

      {/* full: list page between the header chips and the nav */}
      <div
        className={cn(
          "fixed inset-x-0 z-20 flex flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) transition-transform duration-500",
          snap === "full" ? "translate-y-0" : "pointer-events-none invisible translate-y-[calc(100%+8rem)]"
        )}
        style={{
          top: TOP_RESERVED_CSS,
          bottom: "var(--sponti-nav-h, 64px)",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div className="shrink-0 space-y-2 px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">flares near you</h2>
            <button
              type="button"
              onClick={() => onSnap("mid")}
              className="flex h-8 items-center gap-1 rounded-full bg-card px-3 text-xs font-medium text-primary"
            >
              <MapIcon className="h-3.5 w-3.5" />
              map
            </button>
          </div>
          <TimeTabs tab={tab} onTab={onTab} />
          <TypeChips types={types} onToggleType={onToggleType} onClearTypes={onClearTypes} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1">
          {flares.length === 0 ? (
            <EmptyList types={types} onCta={onCta} />
          ) : (
            <div className="space-y-2 pb-4">
              {flares.map((f) => (
                <FlareRow key={f.id} flare={f} onClick={() => onOpenFlare(f)} />
              ))}
              <div className="pt-2">
                <ListCta types={types} onCta={onCta} loud />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function RailCard({ flare, onClick }: { flare: MockFlare; onClick: () => void }) {
  const Icon = typeInfo(flare.type).icon
  return (
    <button
      type="button"
      data-flare={flare.id}
      onClick={onClick}
      className={cn(
        "flex w-[78%] shrink-0 snap-center flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-(--shadow-card) active:scale-[0.99]",
        isLive(flare) && "border-l-[3px] border-l-accent"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{flare.title}</p>
          <p className="truncate text-xs text-muted-foreground">{metaLine(flare)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {flare.going} going
        </span>
        {flare.joined ? (
          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 font-medium text-accent">going</span>
        ) : (
          <span className="font-medium text-foreground">{isLive(flare) ? "live now" : "soon"}</span>
        )}
      </div>
    </button>
  )
}
