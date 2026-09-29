"use client"

// PROTOTYPE (#223): variant B, "vaul drawer".
//
// The same library as the app's other sheets (event-detail-sheet,
// new-event-drawer), so handle, snap physics and easing match by
// construction. The geometry fix is vaul's `container` prop: the drawer is
// portalled into a fixed box whose bottom is the nav's top and whose top
// clears the header chips. vaul measures snap points against that box, so
// "full" (snap point 1) ends at the nav instead of covering it.
//
//   - Non-modal, not dismissible, always open: the map stays interactive.
//   - Snap points: peek (header + filters, measured), 0.5, 1.
//   - vaul already drags the whole drawer until it's at the last snap point,
//     and only then lets a scrollable child scroll; pulling down at
//     scrollTop 0 drags it back. We also set the list to overflow: hidden
//     below full so nothing scrolls by accident.
//   - The type-aware CTA sits in the header row, visible at every height.
//     No FAB: one peach surface on screen.

import { useCallback, useState } from "react"
import { ChevronUp, Flame } from "lucide-react"
import { Drawer } from "vaul"
import { cn } from "@/lib/utils"
import { ctaFor, typeInfo, type Snap } from "./_mock"
import {
  EmptyList,
  FlareRow,
  ListCta,
  TOP_RESERVED_CSS,
  TimeTabs,
  TypeChips,
  type VariantProps,
} from "./_shared"

export function VariantB({
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
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [peekPx, setPeekPx] = useState<string | null>(null)
  // Peek = handle + header + filters, measured once they render.
  const headRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setPeekPx(`${Math.ceil(el.offsetTop + el.offsetHeight + 4)}px`)
  }, [])

  const points: (string | number)[] = [peekPx ?? "150px", 0.5, 1]
  const active = snap === "peek" ? points[0] : snap === "mid" ? 0.5 : 1
  const cta = ctaFor(types)
  const CtaIcon = cta.type ? typeInfo(cta.type).icon : Flame

  return (
    <>
      <div
        ref={setContainer}
        className="pointer-events-none fixed inset-x-0 z-20 overflow-hidden"
        style={{ top: TOP_RESERVED_CSS, bottom: "var(--sponti-nav-h, 64px)" }}
      />
      {container && (
        <Drawer.Root
          open
          modal={false}
          dismissible={false}
          noBodyStyles
          container={container}
          snapPoints={points}
          activeSnapPoint={active}
          setActiveSnapPoint={(p) => {
            const next: Snap = p === 1 ? "full" : p === 0.5 ? "mid" : "peek"
            if (next !== snap) onSnap(next)
          }}
        >
          <Drawer.Portal container={container}>
            <Drawer.Content
              aria-describedby={undefined}
              className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-full flex-col rounded-t-3xl bg-background shadow-(--shadow-sheet) outline-none"
            >
              <Drawer.Handle className="mx-auto mt-2.5 mb-2 h-1.5 w-10 shrink-0 rounded-full bg-border" />
              <Drawer.Title className="sr-only">flares near you</Drawer.Title>

              <div ref={headRef} className="shrink-0 space-y-2 px-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">flares near you</h2>
                    <p className="text-xs text-muted-foreground">{flares.length} active</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCta(cta.type)}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-accent-foreground active:scale-95"
                  >
                    <CtaIcon className="h-4 w-4" />
                    {cta.label}
                  </button>
                </div>
                <TimeTabs tab={tab} onTab={onTab} />
                <TypeChips types={types} onToggleType={onToggleType} onClearTypes={onClearTypes} />
              </div>

              <div
                className={cn(
                  "min-h-0 flex-1 overscroll-contain px-4 pt-1",
                  snap === "full" ? "overflow-y-auto" : "overflow-hidden"
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
                      <ListCta types={types} onCta={onCta} />
                    </div>
                  </div>
                )}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
      {snap === "mid" && flares.length > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 z-20 flex h-16 items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent pb-2"
          style={{ bottom: "var(--sponti-nav-h, 64px)" }}
        >
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
    </>
  )
}
