"use client"

import { useEffect, useState } from "react"

/**
 * True once `active` has stayed true for longer than `delayMs`.
 *
 * #171: a cold Render free-tier instance can take 30-60s to answer the first
 * request after being idle. A plain "loading…" spinner reads as broken that
 * long, so screens that hit the network on first load swap to a "waking up
 * the server…" hint once a request has run long enough to plausibly be
 * paying that cold-start cost, instead of only ever showing "loading" or an
 * outright error.
 */
export function useSlowRequestHint(active: boolean, delayMs = 4000): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => setSlow(true), delayMs)
    // Reset on the way out (deps change or unmount) rather than at the top
    // of the next run, so a stale "slow" from a finished request can't leak
    // into the start of a fresh one.
    return () => {
      window.clearTimeout(id)
      setSlow(false)
    }
  }, [active, delayMs])

  // Gate on `active` too: between the effect firing and this reset landing,
  // `active` has already flipped, so the caller never sees a stale "slow".
  return active && slow
}
