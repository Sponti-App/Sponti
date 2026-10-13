// Reduced motion for the flare moments (#375). Every moment has a reduced
// version (cross-fades only), never nothing.

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

/** Follows the system setting live. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
