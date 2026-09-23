"use client"

import { useEffect, type RefObject } from "react"

type Span = { top: number; bottom: number }

// Breathing room left between a revealed field and the edge it was clipped by,
// so it doesn't sit flush against the pinned CTA.
const REVEAL_GAP_PX = 12

/**
 * How far to scroll `view` so `field` is inside it. Positive scrolls down.
 *
 * Both spans are in viewport coordinates (what getBoundingClientRect returns),
 * so this is a delta to add to scrollTop rather than an absolute position.
 */
export function revealOffset(field: Span, view: Span): number {
  const overflowsTop = field.top < view.top + REVEAL_GAP_PX
  const overflowsBottom = field.bottom > view.bottom - REVEAL_GAP_PX
  if (!overflowsTop && !overflowsBottom) return 0

  // A field taller than the slot can't be fully revealed; show its top, where
  // the label and the caret are, rather than its end.
  const tallerThanView = field.bottom - field.top >= view.bottom - view.top
  if (tallerThanView || overflowsTop)
    return field.top - view.top - REVEAL_GAP_PX
  return field.bottom - view.bottom + REVEAL_GAP_PX
}

/**
 * Keeps the focused field inside the sheet's scrollable area.
 *
 * vaul used to do this — its `usePreventScroll` scrolled the focused input into
 * view when the keyboard opened — but that came bundled with the broken
 * repositioning we had to switch off (issue #94), so the sheet inherits the
 * job. Without it, opening the keyboard shrinks the card until the field the
 * user just tapped is above the fold and the pinned CTA is all that is left
 * where it used to be.
 *
 * Both listeners are global and read the ref when they fire, never at mount:
 * the sheet lives in a portal that is not attached yet when effects first run,
 * so anything captured up front is captured as null and silently never wired.
 *
 * The reveal is deferred two frames. `useSheetVisibleHeight` resizes the card
 * from its own rAF loop, and within a single frame there is no ordering
 * guarantee between the two, so measuring immediately can read the pre-keyboard
 * height. Two frames is past that and still imperceptible.
 *
 * Scrolls the container directly instead of calling scrollIntoView, which is
 * free to scroll ancestors too — on iOS that means panning the layout viewport
 * and dragging the fixed sheet along with it.
 */
export function useFocusedFieldVisible(
  scrollRef: RefObject<HTMLElement | null>,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return

    let frame = 0

    const reveal = () => {
      const scroll = scrollRef.current
      const field = document.activeElement
      if (!scroll) return
      if (!(field instanceof HTMLElement) || !scroll.contains(field)) return

      const offset = revealOffset(
        field.getBoundingClientRect(),
        scroll.getBoundingClientRect()
      )
      if (offset !== 0) scroll.scrollTop += offset
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(reveal)
      })
    }

    const viewport = window.visualViewport
    document.addEventListener("focusin", schedule)
    viewport?.addEventListener("resize", schedule)
    viewport?.addEventListener("scroll", schedule)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("focusin", schedule)
      viewport?.removeEventListener("resize", schedule)
      viewport?.removeEventListener("scroll", schedule)
    }
  }, [scrollRef, active])
}
