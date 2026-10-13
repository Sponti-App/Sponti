// The lighting takeover (#376), "night flare": what plays from the strike
// until the new flare lands on the map. Decided by Patrick on 2026-10-13 from
// the takeover prototype (#576); see docs/decisions/flare-lighting-motion.md.
//
// It covers the whole screen, nav included. The veil comes down (night in
// dark mode, a lighter veil in light mode) while the map zooms in and tilts
// back into a 3D view of the flare's spot. Once the api has created the
// flare, it shoots up on a column of smoke, bursts high over the map into a
// peach bloom that lights the map for a beat, the sparks rain down and the
// pin below catches. Then the map flattens, the veil lifts, and the moment's
// pin hands over to the map's own pin.
//
// Everything here is a pure function of time, kept apart from React and the
// DOM: `renderTakeover(t, kit, …)` sets a handful of transforms and
// opacities through the kit and redraws one canvas. There is no animation
// library, so nothing has to load between the strike and the first frame.
//
// One rule holds throughout: there is only ever one pin for the new flare.
// The moment's pin IS the flare from its first frame; the map holds its own
// pin hidden until the last frame, when the camera is at rest and the
// moment's pin sits exactly on it, and they swap in the same frame.

import { formatClock, formatWeekdayClock } from "@/lib/format-date"
import type { BurstLevel, Point } from "./lighting"
import {
  dot,
  embers,
  glow,
  puff,
  ring,
  sparks,
  type Palette,
} from "./takeover-canvas"
import { ease, envelope, lerp, lerpPt, seg } from "./tween"

// ---- the camera -----------------------------------------------------------------

/**
 * Where the map is: the map point `anchor` (the flare's spot, in screen px
 * at rest) sits at `focus` on screen, the map is scaled by `scale` around it
 * and tilted back by `tilt` degrees. Only the map's transform changes, so
 * the map never re-lays out.
 */
export type Camera = { focus: Point; scale: number; tilt: number }

export const PERSPECTIVE = 900

/** The camera at rest: the identity transform. */
export const restCamera = (anchor: Point): Camera => ({
  focus: anchor,
  scale: 1,
  tilt: 0,
})

/**
 * The CSS transform (with `transform-origin: 0 0`) of an element whose
 * top-left corner is at `origin` on screen.
 */
export function cameraTransform(
  cam: Camera,
  anchor: Point,
  origin: Point = { x: 0, y: 0 }
): string {
  const { focus, scale, tilt } = cam
  const r = (n: number) => Math.round(n * 100) / 100
  return (
    `translate3d(${r(focus.x - origin.x)}px, ${r(focus.y - origin.y)}px, 0) ` +
    (tilt ? `perspective(${PERSPECTIVE}px) rotateX(${r(tilt)}deg) ` : "") +
    `scale(${r(scale * 1000) / 1000}) ` +
    `translate(${r(origin.x - anchor.x)}px, ${r(origin.y - anchor.y)}px)`
  )
}

/** Where a map point (screen px at rest) lands under the camera. */
export function project(cam: Camera, anchor: Point, p: Point): Point {
  const dx = (p.x - anchor.x) * cam.scale
  const dy = (p.y - anchor.y) * cam.scale
  if (!cam.tilt) return { x: cam.focus.x + dx, y: cam.focus.y + dy }
  const a = (cam.tilt * Math.PI) / 180
  const y = dy * Math.cos(a)
  const z = dy * Math.sin(a)
  const f = PERSPECTIVE / (PERSPECTIVE - z)
  return { x: cam.focus.x + dx * f, y: cam.focus.y + y * f }
}

export function lerpCam(a: Camera, b: Camera, k: number, kScale = k): Camera {
  return {
    focus: lerpPt(a.focus, b.focus, k),
    scale: lerp(a.scale, b.scale, kScale),
    tilt: lerp(a.tilt, b.tilt, k),
  }
}

// ---- the timeline ---------------------------------------------------------------

/** The flare leaves its spot: the timeline holds here until the api has it. */
const UP = 880
const BURST = 1400
const CATCH = 1520
const RES = 2350
const END = 3100
const R_GATE = 220
const R_HOLD = 1150
const R_END = R_HOLD + 300

export const TAKEOVER = {
  /** Total length when the api answers in time, in ms. */
  duration: (reduced: boolean) => (reduced ? R_END : END),
  /** Where the timeline holds until the api has created the flare. */
  gate: (reduced: boolean) => (reduced ? R_GATE : UP),
  /** When the flare catches (the success haptic), in ms. */
  ignition: (reduced: boolean) => (reduced ? R_GATE : CATCH),
  /** A failed flare's takeover fades out in this long. */
  dismissMs: 320,
  /** Waiting longer than this on the api, the takeover steps aside. */
  giveUpMs: 12_000,
} as const

/** Where the api is, in the moment's own time (ms). */
export type Gate = {
  /** Real ms since the timeline reached the gate (0 before). */
  wait: number
  /** `wait` when the api answered; Infinity while it hasn't. */
  waitEnd: number
  /** 0–1: the api failed and the takeover is going away. */
  dismiss: number
}

export const NO_GATE: Gate = { wait: 0, waitEnd: 0, dismiss: 0 }

/**
 * The moment's clock. `real` is ms since the strike; `answeredAt` and
 * `failedAt` are when the api answered or failed (ms since the strike), or
 * null. The timeline runs freely up to the gate, holds there until the api
 * has answered, then runs on from the gate. A failure freezes the timeline
 * where it is and dismisses the takeover over `dismissMs`.
 */
export function takeoverClock(input: {
  real: number
  reduced: boolean
  answeredAt: number | null
  failedAt: number | null
}): { t: number; gate: Gate } {
  const { real, answeredAt, failedAt } = input
  const gateAt = TAKEOVER.gate(input.reduced)
  const timeline = (at: number) => {
    const wait = Math.max(0, at - gateAt)
    const waitEnd =
      answeredAt === null ? Infinity : Math.max(0, answeredAt - gateAt)
    return at <= gateAt ? at : gateAt + Math.max(0, wait - waitEnd)
  }
  const wait = Math.max(0, real - gateAt)
  const waitEnd =
    answeredAt === null ? Infinity : Math.max(0, answeredAt - gateAt)
  if (failedAt !== null) {
    return {
      t: timeline(Math.min(real, failedAt)),
      gate: {
        wait,
        waitEnd,
        dismiss: seg(real, failedAt, failedAt + TAKEOVER.dismissMs),
      },
    }
  }
  return { t: timeline(real), gate: { wait, waitEnd, dismiss: 0 } }
}

// ---- the copy -------------------------------------------------------------------

/**
 * When the flare is, under its title: "live now", "in 15 min", "at 7:30 pm",
 * "tomorrow 9:00 am" or "fri 9:00 am". Lowercase, like all product copy.
 */
export function whenLabel(startAt: string | number, now: number): string {
  const start = new Date(startAt)
  const ms = start.getTime() - now
  if (ms <= 0) return "live now"
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `in ${Math.max(1, mins)} min`
  const today = new Date(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(today.getDate() + 1)
  if (start.toDateString() === today.toDateString()) {
    return `at ${formatClock(start)}`
  }
  if (start.toDateString() === tomorrow.toDateString()) {
    return `tomorrow ${formatClock(start)}`
  }
  return formatWeekdayClock(start)
}

// ---- the frame ------------------------------------------------------------------

/** What a frame sets. The flare moment's component implements it. */
export type TakeoverKit = {
  W: number
  H: number
  /** The map's rest camera (the identity transform). */
  rest: Camera
  palette: Palette
  burst: BurstLevel
  /** Light mode gets a lighter veil, dark mode the night. */
  dark: boolean
  ctx: CanvasRenderingContext2D
  /** Moves the map. */
  camera(c: Camera): void
  /** Where the flare's pin is on screen under `c`. */
  pinAt(c: Camera): Point
  /**
   * The veil: 0 clear, 1 full. `spot` 1 leaves a spotlight on the flare's
   * spot (the map shows through), 0 closes it to an even veil.
   */
  scrim(alpha: number, spot: number): void
  /** The warm light over the map from the burst in the sky. */
  tint(alpha: number): void
  hero(o: {
    show: number
    scale: number
    /** 0 unlit (the cover), 1 lit (the pin's own colours). */
    lit: number
    /** The pin's own label ("you · live"), shown as it lands. */
    chip: number
  }): void
  /** The title and when, under the flare. */
  text(show: number, dy: number): void
  /** The canvas layer's opacity, to fade everything on it at once. */
  canvasAlpha(a: number): void
  /** The whole layer's opacity (a failed flare fades it all out). */
  fade(a: number): void
}

/** The veil's strongest, by theme: night in dark mode, lighter in light. */
export const veilMax = (dark: boolean) => (dark ? 1 : 0.82)

const sparkColours = (p: Palette) => [p.peach, p.ember, p.cream]

/** A bump that rises and settles back over `len` ms from `at`. */
function pop(t: number, at: number, len: number, amount: number): number {
  const k = seg(t, at, at + len)
  return k <= 0 || k >= 1 ? 1 : 1 + amount * Math.sin(Math.PI * k) * (1 - k)
}

/** Draws the frame at `t` (timeline ms, see takeoverClock). */
export function renderTakeover(
  t: number,
  k: TakeoverKit,
  reduced: boolean,
  g: Gate
): void {
  k.ctx.clearRect(0, 0, k.W, k.H)
  if (reduced) return renderReduced(t, k, g)
  const { W, H, palette: p, ctx } = k
  const full = k.burst === "full"
  const hero: Camera = {
    focus: { x: W / 2, y: H * 0.68 },
    scale: 1.6,
    tilt: 52,
  }
  const sky = { x: W / 2, y: H * 0.24 }
  const out = ease.inOutCubic(g.dismiss)

  const zoom = seg(t, 0, 950)
  const cam =
    t < RES
      ? lerpCam(k.rest, hero, ease.inOutCubic(zoom), ease.inOutQuart(zoom))
      : lerpCam(hero, k.rest, ease.inOutCubic(seg(t, RES, END)))
  const shown = out > 0 ? lerpCam(cam, k.rest, out) : cam
  k.camera(shown)
  // The veil comes down, then the burst lights the ground for a beat.
  const light = envelope(t, BURST, BURST + 140, BURST + 300, RES)
  k.scrim(
    veilMax(k.dark) *
      (ease.outCubic(seg(t, 0, 600)) - 0.55 * light) *
      (1 - ease.inOutCubic(seg(t, RES, END - 80))),
    1 - 0.8 * ease.inOutCubic(seg(t, UP - 200, UP + 200))
  )
  k.tint((k.dark ? 0.85 : 0.6) * light)
  k.fade(1 - out)

  // While the api hasn't answered, the unlit flare breathes on its spot.
  const waiting = g.wait > 0 && g.wait < g.waitEnd
  k.hero({
    show: seg(t, 300, 520),
    scale:
      lerp(0.6, 1, ease.outBack(seg(t, 300, 700))) *
      pop(t, CATCH, 360, 0.45) *
      (waiting ? 1 + 0.04 * Math.sin(g.wait / 140) : 1),
    lit: seg(t, CATCH, CATCH + 120),
    chip: seg(t, END - 300, END),
  })
  k.text(
    envelope(t, CATCH + 150, CATCH + 400, RES - 100, RES + 120),
    8 * (1 - ease.outCubic(seg(t, CATCH + 150, CATCH + 420)))
  )

  k.canvasAlpha(1 - seg(t, RES + 100, RES + 550))
  const pin = k.pinAt(shown)
  const pinTop = { x: pin.x, y: pin.y - 34 }
  sputter(ctx, p, pinTop, g)
  // The climb: the head decelerates like a shot flare, smoke left behind.
  const headAt = (time: number) => {
    const kk = ease.outCubic(seg(time, UP, BURST))
    const q = lerpPt(pinTop, sky, kk)
    return { x: q.x + Math.sin(kk * Math.PI) * 16, y: q.y }
  }
  for (let b = UP; b < Math.min(t, BURST); b += 14) {
    puff(ctx, t, {
      at: headAt(b),
      born: b,
      life: 1700,
      rise: 26,
      r: [5, 18],
      colour: p.smoke,
      alpha: k.dark ? 0.3 : 0.4,
      salt: b / 50,
    })
  }
  if (t > UP && t < BURST) {
    const head = headAt(t)
    glow(ctx, head, 26, p.peach, 0.95)
    dot(ctx, head, 3.6, p.cream, 1)
    for (let b = UP; b < t; b += 50) {
      sparks(ctx, t, {
        at: headAt(b),
        born: b,
        count: 2,
        reach: [6, 14],
        life: 260,
        colours: [p.peach, p.cream],
        gravity: 14,
        width: 1.5,
        salt: b,
      })
    }
  }
  // The bloom in the sky, and its sparks raining down.
  const bk = seg(t, BURST, BURST + 900)
  if (bk > 0 && bk < 1) {
    glow(
      ctx,
      sky,
      lerp(30, W * 0.95, ease.outCubic(bk)),
      p.peach,
      0.75 * (1 - ease.inCubic(bk))
    )
    glow(ctx, sky, lerp(10, 120, ease.outCubic(bk)), p.flash, 0.9 * (1 - bk))
  }
  sparks(ctx, t, {
    at: sky,
    born: BURST,
    count: full ? 44 : 24,
    reach: full ? [90, 190] : [70, 140],
    life: 1350,
    colours: sparkColours(p),
    gravity: 170,
    width: 2.2,
    salt: 7,
  })
  if (full) {
    sparks(ctx, t, {
      at: sky,
      born: BURST + 160,
      count: 20,
      reach: [40, 90],
      life: 1100,
      colours: [p.cream, p.peach],
      gravity: 120,
      width: 1.6,
      salt: 11,
    })
  }
  // The flare below catches: a flash, a ring or two, a few sparks.
  const ck = seg(t, CATCH, CATCH + 420)
  if (ck > 0 && ck < 1) {
    glow(ctx, pin, lerp(20, 90, ease.outCubic(ck)), p.flash, 0.9 * (1 - ck))
  }
  for (let w = 0; w < (full ? 2 : 1); w++) {
    const kw = seg(t, CATCH + w * 180, CATCH + w * 180 + 700)
    if (kw > 0 && kw < 1) {
      ring(
        ctx,
        pin,
        lerp(22, 110, ease.outCubic(kw)),
        5 * (1 - kw),
        p.peach,
        1 - kw
      )
    }
  }
  sparks(ctx, t, {
    at: pin,
    born: CATCH,
    count: 10,
    reach: [30, 60],
    life: 600,
    colours: sparkColours(p),
    gravity: 26,
  })
  embers(ctx, t, {
    at: { x: pin.x, y: pin.y - 30 },
    from: CATCH,
    to: RES,
    every: full ? 90 : 160,
    rise: H * 0.18,
    life: 1100,
    spread: 36,
    colours: sparkColours(p),
  })
}

/** The unlit flare waiting on the api: a soft glow and a few crackles. */
function sputter(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  at: Point,
  g: Gate
) {
  if (g.wait <= 0) return
  if (g.wait < g.waitEnd) {
    glow(ctx, at, 16, p.peach, 0.45 + 0.25 * Math.sin(g.wait / 120))
  }
  const until = Math.min(g.wait, g.waitEnd)
  // Only the last few are still alive; older ones are skipped outright.
  const first = Math.floor(Math.max(0, until - 600) / 110) * 110
  for (let born = first; born < until; born += 110) {
    sparks(ctx, g.wait, {
      at,
      born,
      count: 2,
      reach: [6, 14],
      life: 300,
      colours: [p.peach, p.cream],
      gravity: 10,
      width: 1.4,
      salt: born + 3,
    })
  }
}

/**
 * Reduced motion: cross-fades only. Nothing travels, scales or flies: the
 * map stays where it is, the veil fades in, the lit pin and its text fade in
 * on the flare's spot once the api has it, then everything fades back.
 */
function renderReduced(t: number, k: TakeoverKit, g: Gate) {
  const out = ease.inOutCubic(g.dismiss)
  k.camera(k.rest)
  k.scrim(veilMax(k.dark) * envelope(t, 0, R_GATE, R_HOLD, R_END - 20), 0)
  k.tint(0)
  k.fade(1 - out)
  k.hero({
    show: seg(t, R_GATE + 1, R_GATE + 200),
    scale: 1,
    lit: 1,
    chip: seg(t, R_HOLD, R_HOLD + 200),
  })
  k.text(envelope(t, R_GATE + 1, R_GATE + 200, R_HOLD - 100, R_HOLD + 120), 0)
  k.canvasAlpha(0)
}
