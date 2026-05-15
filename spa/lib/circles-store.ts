// Shared circles store — backed by localStorage so the circles hub and the
// event-creation flow read/write the same lists. Drops in for the api/
// /me/circles endpoint when wiring up.

import { useSyncExternalStore } from "react"
import { MOCK_CIRCLES, type Circle, type CircleType } from "./circles"

const STORAGE_KEY = "sponti.circles.v1"
const CHANGE_EVENT = "sponti:circles-change"

const SYSTEM_TYPES: CircleType[] = ["inner", "close", "all"]

let cached: Circle[] | null = null

// The three pre-defined circles (inner/close/all) are tier-level identity in
// the UX and must always be present. The backend may not seed them yet, and a
// fetched-then-written empty list would otherwise wipe them locally. We match
// by `type` so backend ObjectIds still resolve correctly once wired up.
export function ensureSystemCircles(circles: Circle[]): Circle[] {
  const head: Circle[] = []
  for (const sysType of SYSTEM_TYPES) {
    const existing = circles.find((c) => c.type === sysType)
    if (existing) {
      head.push(existing)
      continue
    }
    const fallback = MOCK_CIRCLES.find((c) => c.type === sysType)
    if (fallback) head.push(fallback)
  }
  const rest = circles.filter((c) => !SYSTEM_TYPES.includes(c.type))
  return [...head, ...rest]
}

function readFromStorage(): Circle[] {
  if (typeof window === "undefined") return MOCK_CIRCLES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_CIRCLES))
      return MOCK_CIRCLES
    }
    return ensureSystemCircles(JSON.parse(raw) as Circle[])
  } catch {
    return MOCK_CIRCLES
  }
}

function snapshot(): Circle[] {
  if (cached === null) cached = readFromStorage()
  return cached
}

function writeAll(circles: Circle[]): void {
  if (typeof window === "undefined") return
  const next = ensureSystemCircles(circles)
  cached = next
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

const EMPTY: Circle[] = []

export function useCircles(): Circle[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}

export function getCirclesSnapshot(): Circle[] {
  return snapshot()
}

// Mirrors useState's setter — accepts a value or an updater function.
export function setCircles(
  next: Circle[] | ((prev: Circle[]) => Circle[]),
): void {
  const value = typeof next === "function" ? next(snapshot()) : next
  writeAll(value)
}

export function addMemberToCircle(circleId: string, userId: string): void {
  setCircles((prev) =>
    prev.map((c) => {
      if (c.id !== circleId || c.memberIds.includes(userId)) return c
      return {
        ...c,
        memberIds: [...c.memberIds, userId],
        memberAddedAt: { ...c.memberAddedAt, [userId]: new Date().toISOString() },
      }
    }),
  )
}

export function removeMemberFromCircle(circleId: string, userId: string): void {
  setCircles((prev) =>
    prev.map((c) => {
      if (c.id !== circleId) return c
      const { [userId]: _dropped, ...restMeta } = c.memberAddedAt ?? {}
      return {
        ...c,
        memberIds: c.memberIds.filter((id) => id !== userId),
        memberAddedAt: restMeta,
      }
    }),
  )
}

export function moveConnectionToCircle(
  userId: string,
  fromCircleId: string,
  toCircleId: string,
): void {
  const now = new Date().toISOString()
  setCircles((prev) =>
    prev.map((c) => {
      if (c.id === fromCircleId) {
        const { [userId]: _dropped, ...restMeta } = c.memberAddedAt ?? {}
        return {
          ...c,
          memberIds: c.memberIds.filter((id) => id !== userId),
          memberAddedAt: restMeta,
        }
      }
      if (c.id === toCircleId && !c.memberIds.includes(userId)) {
        return {
          ...c,
          memberIds: [...c.memberIds, userId],
          memberAddedAt: { ...c.memberAddedAt, [userId]: now },
        }
      }
      return c
    }),
  )
}
