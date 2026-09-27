"use client"

// Shared mechanism for "screen loaded once and never again" staleness
// (#158): re-run a refetch when the tab/app regains focus or becomes
// visible again, mirroring the pattern `useUnreadCountRefresh` already uses
// for the notification badge (`use-notifications.ts`). Throttled so rapid
// focus/visibilitychange churn (e.g. flipping between tabs) doesn't hammer
// the api with duplicate requests.

import { useEffect, useRef } from "react"

const DEFAULT_MIN_INTERVAL_MS = 15_000

type Options = {
  /** Skip a focus-triggered run if the last one was more recent than this. */
  minIntervalMs?: number
  /** Set false to disable the listeners entirely (e.g. demo mode, no api). */
  enabled?: boolean
}

export function useRefetchOnFocus(
  onRefetch: () => void,
  { minIntervalMs = DEFAULT_MIN_INTERVAL_MS, enabled = true }: Options = {}
): void {
  // Kept in a ref so the listener effect below doesn't need to re-subscribe
  // every time the caller passes a new function identity.
  const onRefetchRef = useRef(onRefetch)
  const lastRunAtRef = useRef(0)

  useEffect(() => {
    onRefetchRef.current = onRefetch
  }, [onRefetch])

  useEffect(() => {
    if (!enabled) return

    const maybeRefetch = (): void => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastRunAtRef.current < minIntervalMs) return
      lastRunAtRef.current = now
      onRefetchRef.current()
    }

    document.addEventListener("visibilitychange", maybeRefetch)
    window.addEventListener("focus", maybeRefetch)

    return () => {
      document.removeEventListener("visibilitychange", maybeRefetch)
      window.removeEventListener("focus", maybeRefetch)
    }
  }, [enabled, minIntervalMs])
}
