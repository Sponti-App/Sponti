"use client"

import { useSyncExternalStore } from "react"

// #313: the first-run intro shows once per device, right after a new account
// is made (email or Google). Device-only: one localStorage key, never sent to
// the backend.
//
//   "pending" — set when an account is created on this device; the home map
//               shows the intro while it is set.
//   "done"    — the intro was finished or skipped; it never shows again here,
//               even for another new account.
//
// With `introV2`, the post-sign-up checklist (#459,
// lib/onboarding-checklist.ts) reads the same state in place of the intro.
//
// Signing in on an existing account drops a leftover "pending" (an intro that
// was never finished before signing out), so it never shows on sign-in.
// Every storage call is wrapped, because localStorage can be missing or throw
// (private windows, blocked site data). Then `memory` keeps the state for the
// rest of the session, so the intro still shows once and then stays away.

export const ONBOARDING_KEY = "sponti.onboarding.v1"

type OnboardingState = "pending" | "done" | null

let memory: OnboardingState | undefined
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function readState(): OnboardingState {
  if (memory !== undefined) return memory
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY)
    return raw === "pending" || raw === "done" ? raw : null
  } catch {
    return null
  }
}

function writeState(next: OnboardingState): void {
  memory = next
  try {
    if (next) window.localStorage.setItem(ONBOARDING_KEY, next)
    else window.localStorage.removeItem(ONBOARDING_KEY)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  notify()
}

/** A new account was just made here: show the intro, unless it already ran. */
export function markOnboardingPending(): void {
  if (readState() === "done") return
  writeState("pending")
}

/** Signed in on an existing account: never show the intro for it. */
export function dropPendingOnboarding(): void {
  if (readState() === "pending") writeState(null)
}

/** The intro was finished or skipped: don't show it again on this device. */
export function completeOnboarding(): void {
  writeState("done")
}

/**
 * #482: show the intro again on this device, for the account that is signed
 * in now: the first-run intro, or the checklist with `introV2`.
 */
export function replayOnboarding(): void {
  writeState("pending")
}

export function shouldShowOnboarding(): boolean {
  return readState() === "pending"
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ONBOARDING_KEY) return
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

/** True while the first-run intro is waiting to be shown on this device. */
export function useShowOnboarding(): boolean {
  return useSyncExternalStore(subscribe, shouldShowOnboarding, () => false)
}

/** Test seam: forget the in-memory state so storage is read again. */
export function resetOnboardingMemory(): void {
  memory = undefined
}
