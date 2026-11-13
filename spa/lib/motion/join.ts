// The first-join moment (#380, flare moments #370). Picked in the prototype
// review (#374, PR #413, variant B "arc") and recorded in
// docs/decisions/flare-moments-direction.md: the friend's avatar pops up in
// the middle of the screen with a ring and a label, then arcs into the nav's
// bell, leaving a spark trail, and the bell swings as it lands. 2.5 s in all.
// Later joins only swing the bell.
//
// Like the lighting takeover (takeover.ts), this is a pure function of time,
// kept apart from React and the DOM, so tests can seek to any frame and no
// animation library has to load.

import { isJoinNotification, type Notification } from "@/lib/notifications"
import type { Point } from "./lighting"
import { ease, seg } from "./tween"

// ---- what plays -------------------------------------------------------------

export type Joiner = { id: string; name: string; avatarUrl: string | null }

/**
 * One poll's joins. A batch with a first join on any of the host's flares
 * plays the overlay and names everyone who joined in it (they stack); a batch
 * of later joins only swings the bell. Batches from separate polls queue.
 */
export type JoinBeat =
  | { kind: "first"; joiners: Joiner[]; title: string; detail: string | null }
  | { kind: "later" }

export function planJoinBeat(batch: Notification[]): JoinBeat | null {
  const joins = batch.filter(isJoinNotification)
  if (joins.length === 0) return null
  if (!joins.some((n) => n.rsvp?.firstJoin)) return { kind: "later" }

  const joiners: Joiner[] = []
  for (const n of joins) {
    const id = n.actorId ?? n.id
    if (joiners.some((j) => j.id === id)) continue
    joiners.push({
      id,
      name: n.actorName ?? "someone",
      avatarUrl: n.actorAvatarUrl ?? null,
    })
  }
  const titles = new Set(joins.map((n) => n.rsvp?.eventTitle ?? null))
  const oneFlare = titles.size === 1
  return {
    kind: "first",
    joiners,
    title: `${joinerNames(joiners)} joined your ${oneFlare ? "flare" : "flares"}`,
    detail: oneFlare ? [...titles][0] : null,
  }
}

/** "mia", "mia and jonas", "mia, jonas and leo", "mia, jonas and 2 more". */
export function joinerNames(joiners: Joiner[]): string {
  const n = joiners.map((j) => j.name)
  if (n.length <= 1) return n[0] ?? ""
  if (n.length > 3) return `${n[0]}, ${n[1]} and ${n.length - 2} more`
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`
}

// ---- timing (ms) --------------------------------------------------------------

export const JOIN_IN = 400
export const JOIN_HOLD = 1350
export const JOIN_FLY = 600
export const JOIN_FLY_AT = JOIN_IN + JOIN_HOLD
/** The avatar reaches the bell: the bell swings and the badge pops. */
export const JOIN_IMPACT = JOIN_FLY_AT + JOIN_FLY
/** The overlay is gone (2.5 s, or 2.6 s with reduced motion). */
export const JOIN_END = JOIN_IMPACT + 150
export const JOIN_END_REDUCED = JOIN_IMPACT + 250
/** How long a later join's bell swing takes before the next beat. */
export const BELL_SWING_MS = 750

export const SPARKS = 10
const SPARK_MS = 450

// ---- frames ---------------------------------------------------------------

/** Where the avatar starts and the bell it lands in (null: no bell on screen). */
export type JoinGeometry = { from: Point; to: Point | null }

type Layer = { x: number; y: number; scale: number; opacity: number }

export type JoinFrame = {
  /** The avatar(s), offset from where they sit. */
  body: Layer
  ring: { scale: number; opacity: number }
  label: { y: number; opacity: number }
  /** Absolute screen positions. */
  sparks: Layer[]
}

const hidden: Layer = { x: 0, y: 0, scale: 0, opacity: 0 }

/** The arc: swings out to the right of both ends, then drops onto the bell. */
export function arcPoint(from: Point, to: Point, p: number): Point {
  const ctrl = {
    x: Math.max(from.x, to.x) + 110,
    y: from.y + (to.y - from.y) * 0.25,
  }
  return {
    x: (1 - p) ** 2 * from.x + 2 * (1 - p) * p * ctrl.x + p ** 2 * to.x,
    y: (1 - p) ** 2 * from.y + 2 * (1 - p) * p * ctrl.y + p ** 2 * to.y,
  }
}

export function joinFrame(
  t: number,
  geo: JoinGeometry,
  reduced: boolean
): JoinFrame {
  if (reduced) {
    // Nothing travels or scales: a fade in where it sits, a hold, a fade out.
    const opacity =
      t < JOIN_IMPACT
        ? seg(t, 0, 200)
        : 1 - seg(t, JOIN_IMPACT, JOIN_END_REDUCED)
    return {
      body: { x: 0, y: 0, scale: 1, opacity },
      ring: { scale: 1, opacity: 0 },
      label: { y: 0, opacity },
      sparks: Array.from({ length: SPARKS }, () => hidden),
    }
  }

  const pop = seg(t, 0, JOIN_IN)
  const ringK = seg(t, 80, 680)
  const labelIn = ease.outCubic(seg(t, 80, 330))
  const labelOut = seg(t, JOIN_FLY_AT, JOIN_FLY_AT + 150)
  const label = { y: 8 * (1 - labelIn), opacity: labelIn * (1 - labelOut) }
  const ring = {
    scale: 1 + 0.9 * ease.outCubic(ringK),
    opacity: t >= 80 && ringK < 1 ? 0.7 * (1 - ease.outCubic(ringK)) : 0,
  }

  const { from, to } = geo
  if (!to) {
    // No bell to land in (the nav is hidden): fade out where it is.
    const out = seg(t, JOIN_FLY_AT, JOIN_IMPACT)
    return {
      body: {
        x: 0,
        y: 0,
        scale: ease.outBack(pop),
        opacity: ease.outCubic(pop) * (1 - out),
      },
      ring,
      label,
      sparks: Array.from({ length: SPARKS }, () => hidden),
    }
  }

  // Gravity: the avatar speeds up as it drops (power2.in in the prototype).
  const p = seg(t, JOIN_FLY_AT, JOIN_IMPACT) ** 2
  const at = arcPoint(from, to, p)
  const flying = t >= JOIN_FLY_AT
  const body: Layer = {
    x: flying ? at.x - from.x : 0,
    y: flying ? at.y - from.y : 0,
    scale: flying ? 1 - 0.78 * p : ease.outBack(pop),
    opacity:
      t >= JOIN_IMPACT
        ? 1 - seg(t, JOIN_IMPACT, JOIN_IMPACT + 80)
        : ease.outCubic(pop),
  }

  // Spark i drops where the avatar passes progress p_i, at FLY * sqrt(p_i).
  const sparks = Array.from({ length: SPARKS }, (_, i): Layer => {
    const pi = (i + 1) / (SPARKS + 1)
    const start = JOIN_FLY_AT + JOIN_FLY * Math.sqrt(pi)
    if (t < start) return hidden
    const k = seg(t, start, start + SPARK_MS)
    const pt = arcPoint(from, to, pi)
    return {
      x: pt.x,
      y: pt.y + 14 * ease.outCubic(k),
      scale: 1.2 * (1 - k),
      opacity: 1 - k,
    }
  })

  return { body, ring, label, sparks }
}
