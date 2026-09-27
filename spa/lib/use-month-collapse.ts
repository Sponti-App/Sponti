"use client"

import { useEffect, type RefObject } from "react"

export const MONTH_COLLAPSE_VAR = "--month-collapse"

/**
 * Maps how far the agenda list has scrolled (`scrollTop`, px) to a 0–1
 * collapse fraction for the month grid: 0 is the full 6-row month, 1 is just
 * the selected day's week row.
 *
 * With `reducedMotion`, the fraction is a step function instead of a ramp —
 * the grid snaps between expanded and collapsed rather than tracking scroll
 * continuously, giving an instant switch with no in-between frames.
 */
export function collapseProgress(
  scrollTop: number,
  distance: number,
  reducedMotion: boolean
): number {
  if (distance <= 0) return scrollTop > 0 ? 1 : 0
  const raw = Math.min(1, Math.max(0, scrollTop / distance))
  return reducedMotion ? (raw >= 0.5 ? 1 : 0) : raw
}

/**
 * Drives the month grid's collapse purely off scroll position — never a
 * timer — by writing `--month-collapse` straight onto `targetRef` every
 * frame the agenda list is scrolling.
 *
 * Mirrors `useSheetVisibleHeight`: this is layout synced to scroll, not
 * state, so it goes through a ref rather than `useState` — a re-render per
 * scroll frame would be wasteful and a frame behind, and would fight the
 * scroll-linked feel the iOS-style collapse depends on.
 */
export function useMonthCollapse(
  scrollContainerRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  distance: number
): void {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    let frame = 0
    let applied = -1

    const measure = () => {
      const container = scrollContainerRef.current
      const target = targetRef.current

      if (container && target) {
        const next = collapseProgress(
          container.scrollTop,
          distance,
          mediaQuery.matches
        )
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
