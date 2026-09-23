"use client"

import { useEffect, type RefObject } from "react"

type Span = { top: number; bottom: number }

/**
 * How much of `sheet` falls inside `viewport`, in px. Both spans are in layout
 * viewport coordinates (what getBoundingClientRect returns).
 */
export function visibleSlotHeight(sheet: Span, viewport: Span): number {
  return Math.max(
    0,
    Math.min(sheet.bottom, viewport.bottom) - Math.max(sheet.top, viewport.top)
  )
}

/**
 * Sizes the sheet's visible card to the slot vaul has actually left on screen,
 * by measuring it every frame while the sheet is open.
 *
 * Predicting this in CSS does not work, and issue #94 burned two attempts at
 * it. vaul owns the sheet's on-screen position through a transform, and
 * additionally rewrites the element's `height` and `bottom` in px whenever the
 * software keyboard opens. A card sized from a CSS constant — `380px`, or a
 * fraction of a viewport-height variable — drifts out of step with all of that:
 * with the keyboard up the slot is smaller than the snap point, so the pinned
 * CTA is clipped, and after the keyboard closes the sheet can be left sitting
 * lower than its snap point with the CTA stranded below the browser toolbar.
 *
 * Measuring sidesteps every one of those cases: whatever vaul does to the
 * transform, height or bottom, the card is exactly as tall as the part of the
 * sheet the user can see, so the pinned CTA sits on the bottom edge of the
 * visible area. It also keeps the card in step during drags and snap
 * animations, which a CSS transition could only approximate.
 *
 * The height is written straight to the node rather than through state: this is
 * layout synchronisation at frame rate, and a re-render per frame would be both
 * wasteful and a frame behind.
 */
export function useSheetVisibleHeight(
  sheetRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return

    let frame = 0
    let applied = -1

    const measure = () => {
      const sheet = sheetRef.current
      const card = cardRef.current

      if (sheet && card) {
        const vv = window.visualViewport
        const viewport = vv
          ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height }
          : { top: 0, bottom: window.innerHeight }

        const next = Math.round(
          visibleSlotHeight(sheet.getBoundingClientRect(), viewport)
        )

        // Only touch the DOM when the value actually moves, so a settled sheet
        // costs one getBoundingClientRect per frame and nothing else.
        if (next !== applied) {
          applied = next
          card.style.height = `${next}px`
        }
      }

      frame = requestAnimationFrame(measure)
    }

    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [sheetRef, cardRef, active])
}
