import { useSyncExternalStore } from "react"
import type { EventType } from "@/lib/api/events"

// The flare type the home map is currently suggesting (#223): set by the map
// when exactly one type chip is on and no live flare of that type is in the
// results, so the bottom nav's flare button can show that type's icon. The map
// is the only writer and resets it to null when it unmounts, so every other
// screen sees the plain flare icon. A module store rather than a context so
// the app shell doesn't need another provider for one value.

let current: EventType | null = null
const listeners = new Set<() => void>()

export function setSuggestedFlareType(type: EventType | null): void {
  if (type === current) return
  current = type
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): EventType | null {
  return current
}

function getServerSnapshot(): EventType | null {
  return null
}

export function useSuggestedFlareType(): EventType | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
