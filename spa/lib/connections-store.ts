// Shared connections store — holds the four pieces of state that the
// connections hub previously kept in component state: who you're friends with,
// who's asking to connect, who you've sent requests to, who you've blocked,
// plus the @handle search pool. Persists via localStorage on the same pattern
// as host-events / circles-store. Drops in for the api/ endpoints later.

import { useSyncExternalStore } from "react"
import {
  MOCK_BLOCKED,
  MOCK_CONNECTIONS,
  MOCK_DISCOVERABLE,
  MOCK_REQUESTS,
  type BlockedUser,
  type Connection,
  type ConnectionRequest,
} from "./circles"
import { setCircles } from "./circles-store"

export type ConnectionsState = {
  connections: Connection[]
  requests: ConnectionRequest[]
  discoverable: Connection[]
  sentRequests: Connection[]
  blocked: BlockedUser[]
}

const STORAGE_KEY = "sponti.connections.v1"
const CHANGE_EVENT = "sponti:connections-change"

function seed(): ConnectionsState {
  return {
    connections: MOCK_CONNECTIONS,
    requests: MOCK_REQUESTS,
    discoverable: MOCK_DISCOVERABLE,
    sentRequests: [],
    blocked: MOCK_BLOCKED,
  }
}

let cached: ConnectionsState | null = null

function readFromStorage(): ConnectionsState {
  if (typeof window === "undefined") return seed()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const s = seed()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
      return s
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // Migrate old shape that stored sentRequestIds: string[] instead of sentRequests: Connection[]
    if (!parsed.sentRequests) parsed.sentRequests = []
    return parsed as unknown as ConnectionsState
  } catch {
    return seed()
  }
}

function snapshot(): ConnectionsState {
  if (cached === null) cached = readFromStorage()
  return cached
}

function writeAll(state: ConnectionsState): void {
  if (typeof window === "undefined") return
  cached = state
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

const EMPTY: ConnectionsState = {
  connections: [],
  requests: [],
  discoverable: [],
  sentRequests: [],
  blocked: [],
}

export function useConnectionsState(): ConnectionsState {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}

export function getConnectionsSnapshot(): ConnectionsState {
  return snapshot()
}

// ---- semantic actions ----

export function sendRequest(target: Connection): void {
  const s = snapshot()
  writeAll({
    ...s,
    discoverable: s.discoverable.filter((d) => d.id !== target.id),
    sentRequests: s.sentRequests.find((r) => r.id === target.id)
      ? s.sentRequests
      : [...s.sentRequests, target],
  })
}

export function cancelSentRequest(targetId: string): void {
  const s = snapshot()
  const cancelled = s.sentRequests.find((r) => r.id === targetId)
  writeAll({
    ...s,
    sentRequests: s.sentRequests.filter((r) => r.id !== targetId),
    discoverable:
      cancelled && !s.discoverable.find((d) => d.id === targetId)
        ? [...s.discoverable, cancelled]
        : s.discoverable,
  })
}

export function acceptRequest(reqId: string): void {
  const s = snapshot()
  const req = s.requests.find((r) => r.id === reqId)
  if (!req) return
  const alreadyConnected = Boolean(s.connections.find((c) => c.id === req.user.id))
  writeAll({
    ...s,
    requests: s.requests.filter((r) => r.id !== reqId),
    connections: alreadyConnected ? s.connections : [...s.connections, req.user],
  })
  if (!alreadyConnected) {
    setCircles((prev) =>
      prev.map((c) =>
        c.id === "all" ? { ...c, memberIds: [...c.memberIds, req.user.id] } : c,
      ),
    )
  }
}

export function declineRequest(reqId: string): void {
  const s = snapshot()
  writeAll({
    ...s,
    requests: s.requests.filter((r) => r.id !== reqId),
  })
}

// Removes the connection AND strips them from every circle in one logical step.
export function removeConnection(targetId: string): void {
  const s = snapshot()
  writeAll({
    ...s,
    connections: s.connections.filter((c) => c.id !== targetId),
  })
  setCircles((prev) =>
    prev.map((c) => ({
      ...c,
      memberIds: c.memberIds.filter((id) => id !== targetId),
    })),
  )
}

export function blockConnection(target: Connection): void {
  const s = snapshot()
  writeAll({
    ...s,
    connections: s.connections.filter((c) => c.id !== target.id),
    discoverable: s.discoverable.filter((d) => d.id !== target.id),
    sentRequests: s.sentRequests.filter((r) => r.id !== target.id),
    blocked: [
      {
        id: target.id,
        displayName: target.displayName,
        username: target.username,
        blockedAt: new Date().toISOString(),
      },
      ...s.blocked.filter((b) => b.id !== target.id),
    ],
  })
  setCircles((prev) =>
    prev.map((c) => ({
      ...c,
      memberIds: c.memberIds.filter((id) => id !== target.id),
    })),
  )
}

export function unblock(targetId: string): void {
  const s = snapshot()
  const wasDiscoverable = MOCK_DISCOVERABLE.find((d) => d.id === targetId)
  writeAll({
    ...s,
    blocked: s.blocked.filter((b) => b.id !== targetId),
    discoverable:
      wasDiscoverable && !s.discoverable.find((d) => d.id === targetId)
        ? [...s.discoverable, wasDiscoverable]
        : s.discoverable,
  })
}
