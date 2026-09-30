"use client"

import { useSyncExternalStore } from "react"
import { addCircleMember, fetchMyCircles } from "@/lib/api/circles"
import {
  fetchIncomingConnectionRequests,
  respondToConnectionRequest,
} from "@/lib/api/connections"
import type { Circle } from "@/lib/circles"
import type { CircleChoice } from "@/components/circle-chips"
import { HttpError } from "@/lib/http"
import { emitEventsChanged } from "@/lib/use-events"

// Answering a connection request from the notification feed (#174, #226).
//
// This lives at module level, not in the row, on purpose: an accept waits
// out a 5 second undo window before it's sent, and the sheet can close (or
// the user can navigate) inside that window. The timer, the queued circle
// and the api calls all keep going here without the row being mounted.
//
// What happens to an accept in the undo window:
// - the sheet closes or the app navigates: it's sent when the window ends,
//   exactly as if nothing happened. The undo toast is app-level and stays.
// - the page is hidden or unloaded (app switched away, tab closed): it's
//   sent right away, so leaving never loses it silently.
// - undo: nothing is sent at all. The other person never hears about it.

export const ACCEPT_UNDO_MS = 5_000
// How long a pending-requests or circles fetch is reused before re-fetching.
const CACHE_MS = 30_000

export type RequestPhase =
  | "idle" // show accept / decline
  | "undo" // accepted locally, inside the undo window, nothing sent yet
  | "accepting" // sent, waiting on the api
  | "accepted"
  | "declining"
  | "declined"
  | "handled" // already answered somewhere else

export type CirclePlacement =
  | { status: "none" }
  // Picked during the undo window; sent once the accept goes through, since
  // the api only adds accepted connections to circles.
  | { status: "queued"; circle: CircleChoice }
  | { status: "adding"; circle: CircleChoice }
  | { status: "added"; circle: CircleChoice }
  | { status: "skipped" }

export type RequestEntry = {
  phase: RequestPhase
  placement: CirclePlacement
}

type Loadable<T> = {
  status: "unknown" | "loading" | "ready" | "failed"
  value: T
  loadedAt: number
}

type State = {
  requests: Readonly<Record<string, RequestEntry>>
  pendingIds: Loadable<ReadonlySet<string>>
  circles: Loadable<Circle[]>
}

type Notifier = (message: string, tone: "success" | "error") => void

type Meta = {
  userId: string | null
  timer: number | null
  notify: Notifier
}

const IDLE: RequestEntry = { phase: "idle", placement: { status: "none" } }

const initialState = (): State => ({
  requests: {},
  pendingIds: { status: "unknown", value: new Set(), loadedAt: 0 },
  circles: { status: "unknown", value: [], loadedAt: 0 },
})

let state: State = initialState()
const meta = new Map<string, Meta>()
const listeners = new Set<() => void>()
let flushListenersInstalled = false

function setState(update: (current: State) => State): void {
  state = update(state)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getEntry(connectionId: string): RequestEntry {
  return state.requests[connectionId] ?? IDLE
}

function patch(connectionId: string, next: Partial<RequestEntry>): void {
  setState((current) => ({
    ...current,
    requests: {
      ...current.requests,
      [connectionId]: { ...getEntry(connectionId), ...next },
    },
  }))
}

function forgetPending(connectionId: string): void {
  setState((current) => {
    if (!current.pendingIds.value.has(connectionId)) return current
    const value = new Set(current.pendingIds.value)
    value.delete(connectionId)
    return { ...current, pendingIds: { ...current.pendingIds, value } }
  })
}

function isGone(err: unknown): boolean {
  return err instanceof HttpError && err.status === 404
}

function clearTimer(connectionId: string): void {
  const entryMeta = meta.get(connectionId)
  if (entryMeta?.timer != null) {
    window.clearTimeout(entryMeta.timer)
    entryMeta.timer = null
  }
}

function installFlushListeners(): void {
  if (flushListenersInstalled || typeof window === "undefined") return
  flushListenersInstalled = true
  window.addEventListener("pagehide", flushPendingAccepts)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingAccepts()
  })
}

// ----- loading -----

/** Which requests are still waiting on an answer, to know which rows get buttons. */
export function ensurePendingRequests(): void {
  const { status, loadedAt } = state.pendingIds
  if (status === "loading") return
  if (status === "ready" && Date.now() - loadedAt < CACHE_MS) return

  setState((current) => ({
    ...current,
    pendingIds: { ...current.pendingIds, status: "loading" },
  }))
  fetchIncomingConnectionRequests()
    .then((requests) => {
      setState((current) => ({
        ...current,
        pendingIds: {
          status: "ready",
          value: new Set(requests.map((request) => request.id)),
          loadedAt: Date.now(),
        },
      }))
    })
    .catch(() => {
      setState((current) => ({
        ...current,
        pendingIds: { ...current.pendingIds, status: "failed" },
      }))
    })
}

/** The owner's circles, for the chips shown after accepting. */
export function ensureCircles(): void {
  const { status, loadedAt } = state.circles
  if (status === "loading") return
  if (status === "ready" && Date.now() - loadedAt < CACHE_MS) return

  setState((current) => ({
    ...current,
    circles: { ...current.circles, status: "loading" },
  }))
  fetchMyCircles()
    .then((circles) => {
      setState((current) => ({
        ...current,
        circles: { status: "ready", value: circles, loadedAt: Date.now() },
      }))
    })
    .catch(() => {
      setState((current) => ({
        ...current,
        circles: { ...current.circles, status: "failed" },
      }))
    })
}

// ----- actions -----

/**
 * Accept, after an undo window. Nothing is sent until the window ends (or
 * the page is hidden). `notify` reports a failure that happens after the
 * row may be gone — pass the app's toast.
 */
export function scheduleAccept(
  connectionId: string,
  {
    userId,
    notify,
    delayMs = ACCEPT_UNDO_MS,
  }: { userId: string | null; notify: Notifier; delayMs?: number }
): void {
  if (getEntry(connectionId).phase !== "idle") return
  installFlushListeners()
  clearTimer(connectionId)
  const timer = window.setTimeout(() => {
    void commitAccept(connectionId)
  }, delayMs)
  meta.set(connectionId, { userId, timer, notify })
  patch(connectionId, { phase: "undo", placement: { status: "none" } })
  ensureCircles()
}

/** Cancels an accept still inside its undo window. Nothing was sent. */
export function undoAccept(connectionId: string): void {
  if (getEntry(connectionId).phase !== "undo") return
  clearTimer(connectionId)
  patch(connectionId, IDLE)
}

/** Sends every accept still waiting on its undo window, now. */
export function flushPendingAccepts(): void {
  for (const [connectionId, entry] of Object.entries(state.requests)) {
    if (entry.phase === "undo") void commitAccept(connectionId)
  }
}

async function commitAccept(connectionId: string): Promise<void> {
  if (getEntry(connectionId).phase !== "undo") return
  clearTimer(connectionId)
  const entryMeta = meta.get(connectionId)
  patch(connectionId, { phase: "accepting" })

  try {
    await respondToConnectionRequest(connectionId, "accepted")
  } catch (err) {
    if (isGone(err)) {
      patch(connectionId, { phase: "handled", placement: { status: "none" } })
      forgetPending(connectionId)
      entryMeta?.notify("that request was already answered", "error")
      return
    }
    patch(connectionId, IDLE)
    entryMeta?.notify("couldn't accept, try again", "error")
    return
  }

  patch(connectionId, { phase: "accepted" })
  forgetPending(connectionId)
  // Accepting changes whose flares each of you can see.
  emitEventsChanged()

  const placement = getEntry(connectionId).placement
  if (placement.status === "queued") {
    await addToCircle(connectionId, placement.circle)
  }
}

async function addToCircle(
  connectionId: string,
  circle: CircleChoice
): Promise<void> {
  const entryMeta = meta.get(connectionId)
  const userId = entryMeta?.userId
  if (!userId) {
    patch(connectionId, { placement: { status: "none" } })
    return
  }

  patch(connectionId, { placement: { status: "adding", circle } })
  try {
    await addCircleMember(circle.id, userId)
  } catch {
    patch(connectionId, { placement: { status: "none" } })
    entryMeta?.notify("couldn't add to circle", "error")
    return
  }

  patch(connectionId, { placement: { status: "added", circle } })
  // Keep the cached circles honest for the next accept's ordering.
  setState((current) => ({
    ...current,
    circles: {
      ...current.circles,
      value: current.circles.value.map((c) =>
        c.id === circle.id && !c.memberIds.includes(userId)
          ? { ...c, memberIds: [...c.memberIds, userId] }
          : c
      ),
    },
  }))
}

/** One tap on a circle chip. Queued if the accept hasn't been sent yet. */
export function pickCircle(connectionId: string, circle: CircleChoice): void {
  const entry = getEntry(connectionId)
  if (entry.placement.status !== "none") return
  if (entry.phase === "undo" || entry.phase === "accepting") {
    patch(connectionId, { placement: { status: "queued", circle } })
    return
  }
  if (entry.phase === "accepted") void addToCircle(connectionId, circle)
}

export function skipCircle(connectionId: string): void {
  const entry = getEntry(connectionId)
  if (entry.placement.status !== "none") return
  if (
    entry.phase === "undo" ||
    entry.phase === "accepting" ||
    entry.phase === "accepted"
  ) {
    patch(connectionId, { placement: { status: "skipped" } })
  }
}

/** The explicit decline button. Swiping never declines (#173). */
export async function declineRequest(
  connectionId: string,
  notify: Notifier
): Promise<void> {
  if (getEntry(connectionId).phase !== "idle") return
  patch(connectionId, { phase: "declining" })
  try {
    await respondToConnectionRequest(connectionId, "rejected")
  } catch (err) {
    if (isGone(err)) {
      patch(connectionId, { phase: "handled" })
      forgetPending(connectionId)
      notify("that request was already answered", "error")
      return
    }
    patch(connectionId, IDLE)
    notify("couldn't decline, try again", "error")
    return
  }
  patch(connectionId, { phase: "declined" })
  forgetPending(connectionId)
}

// ----- react -----

export type ConnectionRequestView = RequestEntry & {
  /** Whether the request is still waiting on an answer, as far as we know. */
  pending: "unknown" | "yes" | "no"
  circles: Circle[] | null
}

function getState(): State {
  return state
}

export function useConnectionRequest(
  connectionId: string
): ConnectionRequestView {
  const current = useSyncExternalStore(subscribe, getState, getState)
  const entry = current.requests[connectionId] ?? IDLE
  const { pendingIds, circles } = current

  let pending: ConnectionRequestView["pending"] = "unknown"
  if (pendingIds.status === "ready") {
    pending = pendingIds.value.has(connectionId) ? "yes" : "no"
  } else if (pendingIds.status === "failed") {
    // Couldn't check: offer the buttons. A stale one answers "already
    // answered" rather than doing anything wrong.
    pending = "yes"
  }

  return {
    ...entry,
    pending,
    circles:
      circles.status === "ready" || circles.status === "failed"
        ? circles.value
        : null,
  }
}

/** Test-only: drop all state and timers. */
export function resetConnectionRequestActions(): void {
  meta.forEach((_, connectionId) => clearTimer(connectionId))
  meta.clear()
  state = initialState()
  listeners.forEach((listener) => listener())
}
