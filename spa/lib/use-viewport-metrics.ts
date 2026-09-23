"use client"

import { useEffect } from "react"

export const VIEWPORT_HEIGHT_VAR = "--sponti-vvh"
export const KEYBOARD_INSET_VAR = "--sponti-kb-inset"

type ViewportLike = { height: number; offsetTop: number } | null | undefined

/**
 * How much of the layout viewport the software keyboard covers, in px.
 *
 * iOS pins `position: fixed` elements to the *layout* viewport, so the keyboard
 * slides over the sheet rather than pushing it up. vaul used to lift the sheet
 * for us, but its arithmetic is wrong for a snapped, transformed drawer — see
 * the `repositionInputs` note at the render site — so we measure the overlap
 * and lift by it ourselves.
 */
export function keyboardInsetPx(
  innerHeight: number,
  viewport: ViewportLike
): number {
  if (!viewport) return 0
  const covered = innerHeight - viewport.height - viewport.offsetTop
  return Math.max(0, Math.round(covered))
}

/**
 * Publishes the two viewport measurements bottom-sheet geometry is built from,
 * as CSS variables on <html>.
 *
 * `--sponti-vvh` is `window.innerHeight`. We cannot use `vh` units for this. On
 * iOS Safari `100vh` is the *large* viewport — it includes the strip behind the
 * collapsible toolbar — whereas vaul positions a snapped sheet by translating
 * it against `window.innerHeight`, which excludes the toolbar. Sizing the
 * sheet's visible card in `vh` therefore makes it taller than the slot vaul
 * left on screen, and the pinned CTA disappears under the browser chrome
 * (issue #94). `window.innerHeight` is the same basis vaul uses, so the two
 * agree by construction.
 *
 * `--sponti-kb-inset` is the keyboard overlap; see `keyboardInsetPx`.
 */
export function useViewportMetrics(): void {
  useEffect(() => {
    const viewport = window.visualViewport

    const write = () => {
      const root = document.documentElement
      root.style.setProperty(VIEWPORT_HEIGHT_VAR, `${window.innerHeight}px`)
      root.style.setProperty(
        KEYBOARD_INSET_VAR,
        `${keyboardInsetPx(window.innerHeight, viewport)}px`
      )
    }

    write()
    window.addEventListener("resize", write)
    window.addEventListener("orientationchange", write)
    // The software keyboard resizes the visual viewport without always firing
    // a window resize, and Safari's toolbar collapsing changes innerHeight.
    // `scroll` fires when the visual viewport pans within the layout viewport,
    // which shifts the overlap without changing either height.
    viewport?.addEventListener("resize", write)
    viewport?.addEventListener("scroll", write)

    return () => {
      window.removeEventListener("resize", write)
      window.removeEventListener("orientationchange", write)
      viewport?.removeEventListener("resize", write)
      viewport?.removeEventListener("scroll", write)
    }
  }, [])
}
