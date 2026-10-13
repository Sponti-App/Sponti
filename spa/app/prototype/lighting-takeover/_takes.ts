// PROTOTYPE (lighting takeover) — throwaway. Take C, "night flare", the
// direction Patrick picked, as a pure render(t) over the Kit (the page's
// setters for the scene's elements).
//
// One rule holds throughout: there is only ever one pin for the new flare.
// The moment's pin (the "hero") IS the flare from the first frame, it sits
// where the camera puts the flare's map point, and the map's own pin stays
// hidden until the last frame, when the camera is at rest and the hero sits
// exactly on it. Then they swap in the same frame (the page's handover).
//
// The takeover starts at the strike. The flare can only go up once the api
// has created it: until then the timeline holds at GATE, the unlit flare
// sputters on its spot, and if the api fails the takeover dismisses itself.

import {
  dot,
  ease,
  embers,
  envelope,
  glow,
  lerp,
  lerpCam,
  lerpPt,
  puff,
  ring,
  seg,
  sparks,
  type Camera,
  type Palette,
  type Point,
} from "./_engine"

export type Burst = "full" | "soft"

export type Kit = {
  W: number
  H: number
  /** Where the map is before the moment (the flare under the composer). */
  start: Camera
  /** Where the map rests after it, as the real map pans to a lit flare. */
  final: Camera
  palette: Palette
  burst: Burst
  /** Light mode: a lighter veil (the page's pale background, not night). */
  dark: boolean
  ctx: CanvasRenderingContext2D
  camera(c: Camera): void
  /**
   * The veil: 0 clear, 1 full. `spot` 1 leaves a spotlight on the flare's
   * spot (the map shows through), 0 closes it to an even veil.
   */
  scrim(alpha: number, spot: number): void
  /** The warm light over the map from the burst in the sky. */
  tint(alpha: number): void
  /** The composer sheet leaving: 0 open, 1 gone. Reduced motion fades it. */
  sheet(k: number, reduced: boolean): void
  hero(o: {
    show: number
    scale: number
    /** 0 unlit (the cover), 1 lit (the pin's own colours). */
    lit: number
    /** The pin's "you · live" label, shown as it lands. */
    chip: number
  }): void
  /** The title and when, under the flare. */
  text(show: number, dy: number): void
  /** The canvas layer's opacity, to fade everything on it at once. */
  canvasAlpha(a: number): void
  /** The whole moment layer's opacity (a failed flare fades it all out). */
  fade(a: number): void
}

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

const UP = 880
const BURST = 1400
const CATCH = 1520
const RES = 2350
const END = 3100
const R_GATE = 220
const R_HOLD = 1150

/** The veil's strongest, by theme: night in dark mode, lighter in light. */
const veilMax = (k: Kit) => (k.dark ? 1 : 0.82)

const SPARK_COLOURS = (p: Palette) => [p.peach, p.ember, p.cream]

/** A bump that rises and settles back over `len` ms from `at`. */
const pop = (t: number, at: number, len: number, amount: number) => {
  const k = seg(t, at, at + len)
  return k <= 0 || k >= 1 ? 1 : 1 + amount * Math.sin(Math.PI * k) * (1 - k)
}

export const take = {
  /** Total length without waiting on the api, in ms. */
  duration: (reduced: boolean) => (reduced ? R_HOLD + 300 : END),
  /** Where the timeline holds until the api has created the flare. */
  gate: (reduced: boolean) => (reduced ? R_GATE : UP),
  /** When the flare catches (the success haptic), in ms. */
  ignition: (reduced: boolean) => (reduced ? R_GATE : CATCH),
  render(t: number, k: Kit, reduced: boolean, g: Gate) {
    if (reduced) return renderReduced(t, k, g)
    const { W, H, palette: p, ctx } = k
    const full = k.burst === "full"
    const HERO: Camera = {
      focus: { x: W / 2, y: H * 0.68 },
      scale: 1.6,
      tilt: 52,
    }
    const sky = { x: W / 2, y: H * 0.24 }
    const out = ease.inOutCubic(g.dismiss)

    k.sheet(ease.inCubic(seg(t, 0, 380)) * (1 - out), false)
    const zoom = seg(t, 0, 950)
    const cam =
      t < RES
        ? lerpCam(k.start, HERO, ease.inOutCubic(zoom), ease.inOutQuart(zoom))
        : lerpCam(HERO, k.final, ease.inOutCubic(seg(t, RES, END)))
    k.camera(out > 0 ? lerpCam(cam, k.start, out) : cam)
    // The veil comes down, then the burst lights the ground for a beat.
    const light = envelope(t, BURST, BURST + 140, BURST + 300, RES)
    k.scrim(
      veilMax(k) *
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
    const pin = cam.focus
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
      colours: SPARK_COLOURS(p),
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
      colours: SPARK_COLOURS(p),
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
      colours: SPARK_COLOURS(p),
    })
  },
}

/** The unlit flare waiting on the api: a soft glow and a few crackles. */
function sputter(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  at: Point,
  g: Gate
) {
  if (g.wait <= 0) return
  const live = g.wait < g.waitEnd
  if (live) glow(ctx, at, 16, p.peach, 0.45 + 0.25 * Math.sin(g.wait / 120))
  const until = Math.min(g.wait, g.waitEnd)
  for (let b = 0; b < until; b += 110) {
    sparks(ctx, g.wait, {
      at,
      born: b,
      count: 2,
      reach: [6, 14],
      life: 300,
      colours: [p.peach, p.cream],
      gravity: 10,
      width: 1.4,
      salt: b + 3,
    })
  }
}

/**
 * Reduced motion: cross-fades only. Nothing travels, scales or flies: the
 * map stays where it is, the veil fades in, the lit pin and its text fade
 * in on the flare's spot once the api has it, then everything fades back.
 */
function renderReduced(t: number, k: Kit, g: Gate) {
  const out = ease.inOutCubic(g.dismiss)
  const end = R_HOLD + 300
  k.sheet(seg(t, 0, 200) * (1 - out), true)
  k.camera(k.start)
  k.scrim(veilMax(k) * envelope(t, 0, R_GATE, R_HOLD, end - 20), 0)
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
