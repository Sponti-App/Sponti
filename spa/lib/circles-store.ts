// Shared circles store — backed by localStorage so the circles hub and the
// event-creation flow read/write the same lists. Drops in for the api/
// /me/circles endpoint when wiring up.

import { useSyncExternalStore } from "react"
import { MOCK_CIRCLES, type Circle } from "./circles"

const STORAGE_KEY = "sponti.circles.v1"
const CHANGE_EVENT = "sponti:circles-change"

let cached: Circle[] | null = null

function isCircleType(value: unknown): value is Circle["type"] {
  return value === "close" || value === "inner" || value === "all"
}

function normalizeCircle(value: unknown): Circle | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null
  const type = isCircleType(raw.type) ? raw.type : "close"
  return {
    id: raw.id,
    name: raw.name,
    description:
      typeof raw.description === "string" ? raw.description : "custom circle",
    type,
    memberIds: Array.isArray(raw.memberIds)
      ? raw.memberIds.filter((id): id is string => typeof id === "string")
      : [],
    color: typeof raw.color === "string" ? raw.color : null,
    icon: typeof raw.icon === "string" ? raw.icon : null,
  }
}

function readFromStorage(): Circle[] {
  if (typeof window === "undefined") return MOCK_CIRCLES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_CIRCLES))
      return MOCK_CIRCLES
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_CIRCLES))
      return MOCK_CIRCLES
    }
    const normalized = parsed
      .map(normalizeCircle)
      .filter((circle): circle is Circle => Boolean(circle))
    if (normalized.length === 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_CIRCLES))
      return MOCK_CIRCLES
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return normalized
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
  cached = circles
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(circles))
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
  next: Circle[] | ((prev: Circle[]) => Circle[])
): void {
  const value = typeof next === "function" ? next(snapshot()) : next
  writeAll(value)
}
