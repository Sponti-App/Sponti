"use client"

import { useSyncExternalStore } from "react"

// Whether the person has switched idea spots off (#245). Device-only: kept in
// localStorage, never sent to the backend, so it follows the browser and not
// the account. Every storage call is wrapped, because localStorage can be
// missing or throw (private windows, blocked site data). When it does, the
// choice still holds for the rest of the session from `memory`.

const IDEAS_HIDDEN_KEY = "sponti.ideas.hidden.v1"

// Set by a write in this session, and cleared when another tab writes, so the
// stored value is read again then.
let memory: boolean | undefined
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function readIdeasHidden(): boolean {
  if (memory !== undefined) return memory
  try {
    return window.localStorage.getItem(IDEAS_HIDDEN_KEY) === "1"
  } catch {
    return false
  }
}

export function setIdeasHidden(hidden: boolean): void {
  memory = hidden
  try {
    if (hidden) window.localStorage.setItem(IDEAS_HIDDEN_KEY, "1")
    else window.localStorage.removeItem(IDEAS_HIDDEN_KEY)
  } catch {
    // Not stored: the choice lasts until the page is reloaded.
  }
  notify()
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== IDEAS_HIDDEN_KEY) return
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

/** True while idea pins and idea cards are switched off on this device. */
export function useIdeasHidden(): boolean {
  return useSyncExternalStore(subscribe, readIdeasHidden, () => false)
}

/** Test seam: forget the in-memory value so the next read hits storage. */
export function resetIdeaPreferencesForTest(): void {
  memory = undefined
  notify()
}
