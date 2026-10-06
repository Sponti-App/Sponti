"use client"

import { useSyncExternalStore } from "react"
import { getOnboardingFlags, useOnboardingFlags } from "@/lib/onboarding-flags"

// #377 (behind `introV2`): the intro slides show once per device, on a
// signed-out visitor's first open of the home map. Device-only: one
// localStorage key, never sent to the backend. Same storage pattern as the
// first-run intro (#313, `onboarding.ts`), with its own key, so a device that
// saw these slides still gets the post-sign-up intro and the other way round.
//
// Leaving the slides any way ("look around", skip, Escape, "i have an
// account") marks them seen. Every storage call is wrapped, because
// localStorage can be missing or throw (private windows, blocked site data).
// Then `memory` keeps the state for the rest of the session, so the slides
// still show once and then stay away until a reload.

export const INTRO_SLIDES_KEY = "sponti.intro-slides.v1"

const SEEN = "seen"

let memory: boolean | undefined
const listeners = new Set<() => void>()

function readSeen(): boolean {
  if (memory !== undefined) return memory
  try {
    return window.localStorage.getItem(INTRO_SLIDES_KEY) === SEEN
  } catch {
    return false
  }
}

/** The slides were left (any way): don't show them again on this device. */
export function markIntroSlidesSeen(): void {
  memory = true
  try {
    window.localStorage.setItem(INTRO_SLIDES_KEY, SEEN)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

/** #482: forget that the slides were seen, so this device sees them again. */
export function resetIntroSlides(): void {
  memory = false
  try {
    window.localStorage.removeItem(INTRO_SLIDES_KEY)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

/** With `introV2` on, whether this device still has to see the slides. */
export function shouldShowIntroSlides(): boolean {
  return getOnboardingFlags().introV2 && !readSeen()
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== INTRO_SLIDES_KEY) return
    memory = undefined
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** True while the intro slides are waiting to be shown on this device. */
export function useShowIntroSlides(): boolean {
  const { introV2 } = useOnboardingFlags()
  const unseen = useSyncExternalStore(
    subscribe,
    () => !readSeen(),
    () => false
  )
  return introV2 && unseen
}

/** Test seam: forget the in-memory state so storage is read again. */
export function resetIntroSlidesMemory(): void {
  memory = undefined
}
