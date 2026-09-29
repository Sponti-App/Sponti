"use client"

import { useEffect, type RefObject } from "react"

export const MONTH_COLLAPSE_VAR = "--month-collapse"

/**
 * Maps how far the agenda list has scrolled (`scrollTop`, px) to a 0–1
 * collapse fraction for the month overlay: 0 is the full month, 1 is just the
 * selected day's week row.
 *
 * Always a continuous ramp, including with reduced motion (#224): the overlay
 * shrinks by exactly the pixels scrolled, so its edge moves with the list like
 * scrolled content does. A step here would let the overlay cover the top of
 * the list until the halfway point. Reduced motion is handled where the
 * calendar scrolls by itself instead (no smooth scrolling).
 */
export function collapseProgress(scrollTop: number, distance: number): number {
  if (distance <= 0) return scrollTop > 0 ? 1 : 0
  return Math.min(1, Math.max(0, scrollTop / distance))
}

/**
 * Drives the month overlay's collapse purely off scroll position — never a
 * timer — by writing `--month-collapse` straight onto `targetRef` every
 * frame the agenda list is scrolling.
 *
 * Mirrors `useSheetVisibleHeight`: this is layout synced to scroll, not
 * state, so it goes through a ref rather than `useState` — a re-render per
 * scroll frame would be wasteful and a frame behind, and would fight the
 * scroll-linked feel the iOS-style collapse depends on.
 *
 * The overlay is out of flow (#224), so collapsing it never changes the
 * scroll container's `scrollHeight` — the feedback loop behind #179's
 * snap-back can't happen.
 */
export function useMonthCollapse(
  scrollContainerRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  distance: number
): void {
  useEffect(() => {
    let frame = 0
    let applied = -1

    const measure = () => {
      const container = scrollContainerRef.current
      const target = targetRef.current

      if (container && target) {
        const next = collapseProgress(container.scrollTop, distance)
        // Only touch the DOM when the value actually moves, so a settled
        // scroll position costs one property read per frame and nothing else.
        if (next !== applied) {
          applied = next
          target.style.setProperty(MONTH_COLLAPSE_VAR, String(next))
        }
      }

      frame = requestAnimationFrame(measure)
    }

    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [scrollContainerRef, targetRef, distance])
}
