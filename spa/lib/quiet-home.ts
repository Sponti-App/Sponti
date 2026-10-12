"use client"

// #522, #561: when the quiet home's "you recently connected" card shows.
//
// Patrick's rule (#561): the card shows only after a fresh sign-in, and only
// when 2 or more connections are new since the card was last shown or
// dismissed. It then keeps those people (at most three, newest first) until
// it is swiped away or the next sign-in. A swipe hides it until both are true
// again: a new sign-in and a new batch.
//
// "Fresh sign-in", concretely: the auth provider calls `markFreshSignIn` on
// every successful login, Google sign-in and sign-up (auth-provider.tsx). A
// session restored from storage or refreshed in the background is not one.
// The first time the quiet home shows with the connections loaded, the sign-in
// is used up: either it starts a batch, or (fewer than two new) it lapses, so
// a friend accepted later in the same session doesn't pop the card up.
//
// With no record yet on this device (a first sign-in here), "new" means
// accepted in the last 14 days, the old #522 window.
//
// Device-only, like the intro slides (`intro-slides.ts`): one localStorage
// key, every call wrapped (storage can be missing or throw), and `memory`
// holds the state when it can't be stored. Keyed by user id, so another
// account signing in on the device starts from scratch.

import { useSyncExternalStore } from "react"
import type { Connection } from "@/lib/circles"

export const RECENT_PEOPLE_KEY = "sponti.recent-people.v1"
/** How many new connections bring the card back. */
export const RECENT_BATCH_MIN = 2
/** How many people the card shows at most. */
export const RECENT_CONNECTION_MAX = 3
/** With no record on the device, how far back "new" reaches. */
export const RECENT_CONNECTION_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

export type RecentPeopleState = {
  userId: string | null
  /** Set by a sign-in, used up by the first quiet home after it. */
  fresh: boolean
  /** When the card was last shown or dismissed (ms), null if never. */
  lastAt: number | null
  /** The people on the card right now (connection user ids), or none. */
  batch: string[] | null
}

export const EMPTY_RECENT_PEOPLE: RecentPeopleState = {
  userId: null,
  fresh: false,
  lastAt: null,
  batch: null,
}

function parse(raw: string | null): RecentPeopleState {
  if (!raw) return EMPTY_RECENT_PEOPLE
  try {
    const value = JSON.parse(raw) as Partial<RecentPeopleState>
    return {
      userId: typeof value.userId === "string" ? value.userId : null,
      fresh: value.fresh === true,
      lastAt:
        typeof value.lastAt === "number" && Number.isFinite(value.lastAt)
          ? value.lastAt
          : null,
      batch: Array.isArray(value.batch)
        ? value.batch.filter((id): id is string => typeof id === "string")
        : null,
    }
  } catch {
    return EMPTY_RECENT_PEOPLE
  }
}

let memory: RecentPeopleState | undefined
const listeners = new Set<() => void>()

export function readRecentPeopleState(): RecentPeopleState {
  if (memory !== undefined) return memory
  try {
    memory = parse(window.localStorage.getItem(RECENT_PEOPLE_KEY))
  } catch {
    memory = EMPTY_RECENT_PEOPLE
  }
  return memory
}

export function writeRecentPeopleState(next: RecentPeopleState): void {
  memory = next
  try {
    window.localStorage.setItem(RECENT_PEOPLE_KEY, JSON.stringify(next))
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

/** A sign-in just succeeded: the next quiet home may show a new batch. */
export function markFreshSignIn(userId: string): void {
  const prev = readRecentPeopleState()
  writeRecentPeopleState(
    prev.userId === userId
      ? { ...prev, fresh: true, batch: null }
      : { ...EMPTY_RECENT_PEOPLE, userId, fresh: true }
  )
}

/** Connections accepted after `since`, newest first. */
export function newConnectionsSince(
  connections: readonly Connection[],
  since: number,
  now: number
): Connection[] {
  return connections
    .filter((c) => {
      const at = c.connectedAt ? Date.parse(c.connectedAt) : NaN
      return Number.isFinite(at) && at > since && at <= now + DAY_MS
    })
    .sort((a, b) => Date.parse(b.connectedAt!) - Date.parse(a.connectedAt!))
}

/**
 * The state after the quiet home shows with `connections` loaded: a fresh
 * sign-in either starts a batch (2+ new) or lapses. Returns `state` itself
 * when nothing changes.
 */
export function settleRecentPeople(
  state: RecentPeopleState,
  userId: string,
  connections: readonly Connection[],
  now: number
): RecentPeopleState {
  if (state.userId !== userId) {
    // Another account's record (or none): nothing was signed into here.
    return state.userId === null && !state.fresh
      ? state
      : { ...EMPTY_RECENT_PEOPLE, userId }
  }
  if (state.batch || !state.fresh) return state
  const since = state.lastAt ?? now - RECENT_CONNECTION_DAYS * DAY_MS
  const fresh = newConnectionsSince(connections, since, now)
  if (fresh.length < RECENT_BATCH_MIN) return { ...state, fresh: false }
  return {
    ...state,
    fresh: false,
    lastAt: now,
    batch: fresh.slice(0, RECENT_CONNECTION_MAX).map((c) => c.id),
  }
}

/** The people on the card: the batch's connections, newest first. */
export function batchPeople(
  state: RecentPeopleState,
  userId: string | null,
  connections: readonly Connection[]
): Connection[] {
  if (!userId || state.userId !== userId || !state.batch) return []
  const ids = new Set(state.batch)
  return connections
    .filter((c) => ids.has(c.id))
    .sort(
      (a, b) =>
        (Date.parse(b.connectedAt ?? "") || 0) -
        (Date.parse(a.connectedAt ?? "") || 0)
    )
}

/** The card was swiped away: hide it until a new sign-in and a new batch.
 * Returns the state before, for undo. */
export function dismissRecentPeople(now: number): RecentPeopleState {
  const prev = readRecentPeopleState()
  writeRecentPeopleState({ ...prev, fresh: false, lastAt: now, batch: null })
  return prev
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== RECENT_PEOPLE_KEY) return
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

export function useRecentPeopleState(): RecentPeopleState {
  return useSyncExternalStore(
    subscribe,
    readRecentPeopleState,
    () => EMPTY_RECENT_PEOPLE
  )
}

/** Test seam: forget the in-memory state so storage is read again. */
export function resetRecentPeopleMemory(): void {
  memory = undefined
}
