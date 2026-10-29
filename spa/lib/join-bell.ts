"use client"

// How the nav's bell reacts to the join moment (#380): the moment sets a cue
// when a join lands, and the bell swings (or, with reduced motion, lights up)
// and its badge pops. While a first join is still in the air, `heldUnread`
// keeps the badge as it was, so it only shows once the avatar lands.

import { useSyncExternalStore } from "react"

export type BellCue = { kind: "swing" | "highlight"; key: number }

type JoinBell = { heldUnread: number | null; cue: BellCue | null }

let bell: JoinBell = { heldUnread: null, cue: null }
const listeners = new Set<() => void>()
let cueKey = 0
let clearCue: ReturnType<typeof setTimeout> | undefined

function set(next: Partial<JoinBell>) {
  bell = { ...bell, ...next }
  listeners.forEach((l) => l())
}

/** Keep the badge at `unread` until the next cue (no-op if already held). */
export function holdBellBadge(unread: number) {
  if (bell.heldUnread === null) set({ heldUnread: unread })
}

/** The join landed: release the badge and swing or light the bell. */
export function cueBell(kind: BellCue["kind"], ms: number) {
  clearTimeout(clearCue)
  set({ heldUnread: null, cue: { kind, key: ++cueKey } })
  clearCue = setTimeout(() => set({ cue: null }), ms)
}

export function resetJoinBell() {
  clearTimeout(clearCue)
  set({ heldUnread: null, cue: null })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const snapshot = () => bell
const server: JoinBell = { heldUnread: null, cue: null }

export function useJoinBell(): JoinBell {
  return useSyncExternalStore(subscribe, snapshot, () => server)
}
