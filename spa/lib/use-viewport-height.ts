"use client"

import { useEffect } from "react"

export const VIEWPORT_HEIGHT_VAR = "--sponti-vvh"

/**
 * Publishes the viewport height that bottom-sheet geometry must be measured
 * against, as a CSS variable.
 *
 * We cannot use `vh` units for this. On iOS Safari `100vh` is the *large*
 * viewport — it includes the strip behind the collapsible toolbar — whereas
 * vaul positions a snapped sheet by translating it against
 * `window.innerHeight`, which excludes the toolbar. Sizing the sheet's visible
 * card in `vh` therefore makes it taller than the slot vaul left on screen,
 * and the pinned CTA disappears under the browser chrome (issue #94).
 *
 * `window.innerHeight` is the same basis vaul uses, so the two agree by
 * construction.
 */
export function useViewportHeightVar(): void {
  useEffect(() => {
    const write = () => {
      document.documentElement.style.setProperty(
        VIEWPORT_HEIGHT_VAR,
        `${window.innerHeight}px`
      )
    }

    write()
    window.addEventListener("resize", write)
    window.addEventListener("orientationchange", write)
    // The software keyboard resizes the visual viewport without always firing
    // a window resize, and Safari's toolbar collapsing changes innerHeight.
    window.visualViewport?.addEventListener("resize", write)

    return () => {
      window.removeEventListener("resize", write)
      window.removeEventListener("orientationchange", write)
      window.visualViewport?.removeEventListener("resize", write)
    }
  }, [])
}
