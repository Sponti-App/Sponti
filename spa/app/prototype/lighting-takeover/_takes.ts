// PROTOTYPE (lighting takeover) — throwaway. The three takes, each a pure
// render(t) over the Kit (the page's setters for the scene's elements).
//
// One rule holds in every take: there is only ever one pin for the new flare.
// The moment's pin (the "hero") IS the flare from the first frame, it sits
// where the camera puts the flare's map point, and the map's own pin stays
// hidden until the last frame, when the camera is at rest and the hero sits
// exactly on it. Then they swap in the same frame (Kit.handover).

import {
  dot,
  ease,
  embers,
  envelope,
  fusePoint,
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
export type TakeKey = "a" | "b" | "c"

export type Kit = {
  W: number
  H: number
  /** Where the map starts (the flare is under the composer). */
  start: Camera
  /** Where the map rests after, as the real map pans to a lit flare. */
  final: Camera
  /** The nav's flare button, where the fuse starts. */
  origin: Point
  palette: Palette
  burst: Burst
  ctx: CanvasRenderingContext2D
  camera(c: Camera): void
  /**
   * The night: 0 clear, 1 the full scrim. `spot` 1 leaves a spotlight on
   * the flare's spot (the map shows through), 0 closes it to plain night.
   */
  scrim(alpha: number, spot: number): void
  /** C's warm light over the map from the burst in the sky. */
  tint(alpha: number): void
  /** The composer sheet leaving: 0 open, 1 gone. Reduced motion fades it. */
  sheet(k: number, reduced: boolean): void
  hero(o: {
    show: number
    scale: number
    /** 0 unlit (the cover), 1 lit (the pin's own colours). */
    lit: number
    /** The small flame on top, as a scale (0 = none). */
    flame: number
    flameAlpha?: number
    /** The pin's "you · live" label, shown as it lands. */
    chip: number
    t: number
  }): void
  text(show: number, dy: number, below?: number): void
  word(show: number, scale: number, at: Point): void
  /** The canvas layer's opacity, to fade everything on it at once. */
  canvasAlpha(a: number): void
}

export type Take = {
  label: string
  /** Total length, in ms. */
  duration(reduced: boolean): number
  /** When the flare catches (the success haptic), in ms. */
  ignition(reduced: boolean): number
  render(t: number, k: Kit, reduced: boolean): void
}

const SPARK_COLOURS = (p: Palette) => [p.peach, p.ember, p.cream]

/** A bump that rises and settles back over `len` ms from `at`. */
const pop = (t: number, at: number, len: number, amount: number) => {
  const k = seg(t, at, at + len)
  return k <= 0 || k >= 1 ? 1 : 1 + amount * Math.sin(Math.PI * k) * (1 - k)
}

/**
 * The fuse: a rope from `from` up to `to`. Before `burnFrom` it shows whole;
 * the spark then runs along it until `burnTo`, eating the rope behind it.
 */
function fuse(
  ctx: CanvasRenderingContext2D,
  t: number,
  p: Palette,
  o: {
    from: Point
    to: Point
    sway: number
    showFrom: number
    burnFrom: number
    burnTo: number
  }
) {
  const show = seg(t, o.showFrom, o.showFrom + 150)
  if (show <= 0 || t > o.burnTo + 60) return
  const head = ease.inOutSine(seg(t, o.burnFrom, o.burnTo))
  const N = 48
  // The rope still to burn.
  ctx.globalAlpha = 0.55 * show
  ctx.strokeStyle = p.smoke
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  for (let i = 0; i <= N; i++) {
    const kk = head + ((1 - head) * i) / N
    const q = fusePoint(o.from, o.to, o.sway, kk)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  if (t < o.burnFrom) return
  // A short glowing stretch just behind the spark.
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = p.peach
  ctx.lineWidth = 2.5
  ctx.beginPath()
  for (let i = 0; i <= 10; i++) {
    const kk = Math.max(0, head - 0.07 + (0.07 * i) / 10)
    const q = fusePoint(o.from, o.to, o.sway, kk)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  ctx.stroke()
  const at = fusePoint(o.from, o.to, o.sway, head)
  glow(ctx, at, 20, p.peach, 0.9)
  dot(ctx, at, 3.2, p.cream, 1)
  // Crackles thrown off the spark as it runs.
  for (let b = o.burnFrom; b < Math.min(t, o.burnTo); b += 55) {
    const kk = ease.inOutSine(seg(b, o.burnFrom, o.burnTo))
    sparks(ctx, t, {
      at: fusePoint(o.from, o.to, o.sway, kk),
      born: b,
      count: 3,
      reach: [6, 18],
      life: 280,
      colours: [p.peach, p.cream],
      gravity: 8,
      width: 1.6,
      salt: b,
    })
  }
}

/** The catch: a flash, one or two shockwaves and a spray of sparks. */
function ignite(
  ctx: CanvasRenderingContext2D,
  t: number,
  p: Palette,
  at: Point,
  o: {
    born: number
    waves: number
    flash: number
    count: number
    reach: [number, number]
    life?: number
  }
) {
  const k = seg(t, o.born, o.born + 420)
  if (k > 0 && k < 1) {
    glow(ctx, at, lerp(20, o.flash, ease.outCubic(k)), p.cream, 0.9 * (1 - k))
    glow(
      ctx,
      at,
      lerp(30, o.flash * 1.3, ease.outCubic(k)),
      p.peach,
      0.6 * (1 - k)
    )
  }
  for (let w = 0; w < o.waves; w++) {
    const kw = seg(t, o.born + w * 180, o.born + w * 180 + 700)
    if (kw > 0 && kw < 1) {
      ring(
        ctx,
        at,
        lerp(22, o.flash * 1.25, ease.outCubic(kw)),
        5 * (1 - kw),
        p.peach,
        1 - kw
      )
    }
  }
  sparks(ctx, t, {
    at,
    born: o.born,
    count: o.count,
    reach: o.reach,
    life: o.life ?? 760,
    colours: SPARK_COLOURS(p),
    gravity: 26,
  })
}

/** The reduced-motion moment, the same for every take: cross-fades only. */
function reducedRender(t: number, k: Kit, hold: number, title: boolean) {
  const end = hold + 300
  k.sheet(seg(t, 0, 200), true)
  // Nothing travels: the map stays where it is and the flare fades in on it.
  k.camera(k.start)
  k.scrim(envelope(t, 0, 220, hold, end - 20), 0)
  k.tint(0)
  k.hero({
    show: seg(t, 220, 420),
    scale: 1,
    lit: 1,
    flame: 1,
    flameAlpha: envelope(t, 220, 420, hold - 100, hold + 120),
    chip: seg(t, hold, hold + 200),
    t: 0,
  })
  k.text(title ? envelope(t, 220, 420, hold - 100, hold + 120) : 0, 0)
  k.word(0, 1, { x: 0, y: 0 })
  k.canvasAlpha(0)
}

// ---- A · match --------------------------------------------------------------

/**
 * The straight "it's a match": the screen goes to night, the map rushes in
 * on the flare's spot, a fuse runs up from the flare button, the flare
 * catches with a flash, shockwaves and sparks, smoke signals rise, and the
 * title lands. Then the night lifts and the map settles with the pin.
 */
export const takeA: Take = {
  label: "a · match",
  duration: (reduced) => (reduced ? 1450 : 3400),
  ignition: (reduced) => (reduced ? 220 : 1450),
  render(t, k, reduced) {
    if (reduced) return reducedRender(t, k, 1150, true)
    const { W, H, palette: p, ctx } = k
    const full = k.burst === "full"
    const IGN = 1450
    const RES = 2700
    const END = 3400
    const HERO: Camera = {
      focus: { x: W / 2, y: H * 0.42 },
      scale: 2.4,
      tilt: 0,
    }

    k.sheet(ease.inCubic(seg(t, 0, 380)), false)
    const zoom = seg(t, 0, 950)
    const cam =
      t < RES
        ? lerpCam(k.start, HERO, ease.inOutCubic(zoom), ease.inOutQuart(zoom))
        : lerpCam(HERO, k.final, ease.inOutCubic(seg(t, RES, END)))
    k.camera(cam)
    // The spotlight shows the map rushing in, then closes as the flare
    // becomes the light.
    k.scrim(
      ease.outCubic(seg(t, 0, 500)) *
        (1 - ease.inOutCubic(seg(t, RES, END - 80))),
      1 - 0.9 * ease.inOutCubic(seg(t, IGN - 150, IGN + 250))
    )
    k.tint(0)

    k.hero({
      show: seg(t, 250, 450),
      scale:
        lerp(0.5, 1, ease.outBack(seg(t, 250, 650))) * pop(t, IGN, 380, 0.5),
      lit: seg(t, IGN, IGN + 120),
      flame:
        t < RES
          ? ease.outBack(seg(t, IGN, IGN + 320)) * 1.25
          : 1.25 * (1 - ease.inCubic(seg(t, RES, RES + 320))),
      chip: seg(t, END - 320, END),
      t,
    })
    k.text(
      envelope(t, IGN + 200, IGN + 500, RES - 80, RES + 160),
      10 * (1 - ease.outCubic(seg(t, IGN + 200, IGN + 520)))
    )
    k.word(0, 1, cam.focus)

    // The canvas: fuse, catch, smoke signals and embers, all at the flare.
    k.canvasAlpha(1 - seg(t, RES, RES + 450))
    const pin = cam.focus
    fuse(ctx, t, p, {
      from: k.origin,
      to: { x: pin.x, y: pin.y + 24 },
      sway: W * 0.22,
      showFrom: 650,
      burnFrom: 820,
      burnTo: IGN,
    })
    const smokeAt = { x: pin.x, y: pin.y - 62 }
    const puffs = full
      ? [IGN + 150, IGN + 450, IGN + 750]
      : [IGN + 150, IGN + 500]
    puffs.forEach((born, i) =>
      puff(ctx, t, {
        at: smokeAt,
        born,
        life: 1500,
        rise: H * 0.36,
        r: [14, 46],
        colour: p.smoke,
        alpha: 0.6,
        salt: i * 2.1,
      })
    )
    embers(ctx, t, {
      at: { x: pin.x, y: pin.y - 30 },
      from: IGN,
      to: RES,
      every: full ? 60 : 130,
      rise: H * 0.3,
      life: 1400,
      spread: 46,
      colours: SPARK_COLOURS(p),
    })
    ignite(ctx, t, p, pin, {
      born: IGN,
      waves: full ? 2 : 1,
      flash: full ? 150 : 100,
      count: full ? 30 : 14,
      reach: full ? [90, 175] : [55, 100],
    })
  },
}

// ---- B · quiet ----------------------------------------------------------------

/**
 * The same ingredients, quieter, for every flare after the first: a lighter
 * dim, a small push in, a short wick under the pin, one ring, a few sparks
 * and one smoke signal, one line of text. About 1.6 s.
 */
export const takeB: Take = {
  label: "b · quiet",
  duration: (reduced) => (reduced ? 1050 : 1600),
  ignition: (reduced) => (reduced ? 220 : 700),
  render(t, k, reduced) {
    if (reduced) return reducedRender(t, k, 750, true)
    const { W, H, palette: p, ctx } = k
    const full = k.burst === "full"
    const IGN = 700
    const RES = 1120
    const END = 1600
    const HERO: Camera = {
      focus: { x: W / 2, y: H * 0.4 },
      scale: 1.5,
      tilt: 0,
    }

    k.sheet(ease.inCubic(seg(t, 0, 320)), false)
    const cam =
      t < RES
        ? lerpCam(k.start, HERO, ease.inOutCubic(seg(t, 0, 620)))
        : lerpCam(HERO, k.final, ease.inOutCubic(seg(t, RES, END)))
    k.camera(cam)
    k.scrim(
      0.9 *
        ease.outCubic(seg(t, 0, 300)) *
        (1 - ease.inOutCubic(seg(t, RES, END - 60))),
      1 - 0.85 * ease.inOutCubic(seg(t, IGN - 120, IGN + 180))
    )
    k.tint(0)

    k.hero({
      show: seg(t, 120, 320),
      scale:
        lerp(0.7, 1, ease.outBack(seg(t, 120, 420))) * pop(t, IGN, 300, 0.3),
      lit: seg(t, IGN, IGN + 100),
      flame:
        t < RES
          ? ease.outBack(seg(t, IGN, IGN + 220))
          : 1 - ease.inCubic(seg(t, RES, RES + 260)),
      chip: seg(t, END - 260, END),
      t,
    })
    k.text(
      envelope(t, IGN + 60, IGN + 220, RES + 40, RES + 220),
      6 * (1 - ease.outCubic(seg(t, IGN + 60, IGN + 240))),
      40
    )
    k.word(0, 1, cam.focus)

    k.canvasAlpha(1 - seg(t, RES, RES + 300))
    const pin = cam.focus
    fuse(ctx, t, p, {
      from: { x: pin.x + 14, y: pin.y + 120 },
      to: { x: pin.x, y: pin.y + 24 },
      sway: 26,
      showFrom: 260,
      burnFrom: 380,
      burnTo: IGN,
    })
    ;(full ? [IGN + 60, IGN + 300] : [IGN + 60]).forEach((born, i) =>
      puff(ctx, t, {
        at: { x: pin.x, y: pin.y - 52 },
        born,
        life: 950,
        rise: H * 0.16,
        r: [10, 30],
        colour: p.smoke,
        alpha: 0.5,
        salt: i * 2.1,
      })
    )
    embers(ctx, t, {
      at: { x: pin.x, y: pin.y - 26 },
      from: IGN,
      to: RES,
      every: full ? 70 : 120,
      rise: H * 0.15,
      life: 800,
      spread: 30,
      colours: SPARK_COLOURS(p),
      alpha: 0.9,
    })
    ignite(ctx, t, p, pin, {
      born: IGN,
      waves: 1,
      flash: full ? 100 : 72,
      count: full ? 18 : 10,
      reach: full ? [60, 105] : [36, 64],
      life: 600,
    })
  },
}

// ---- C · night flare ----------------------------------------------------------

/**
 * The wildcard: night falls and the map tilts back into a 3D view of the
 * spot. The flare shoots up from the pin on a column of smoke, bursts high
 * in the sky into a peach bloom that lights the whole map for a beat, with
 * an oversized "lit" in it, and the sparks rain down as the pin below
 * catches. Then the map flattens and settles with the pin.
 */
export const takeC: Take = {
  label: "c · night flare",
  duration: (reduced) => (reduced ? 1450 : 3100),
  ignition: (reduced) => (reduced ? 220 : 1400),
  render(t, k, reduced) {
    if (reduced) return reducedRender(t, k, 1150, true)
    const { W, H, palette: p, ctx } = k
    const full = k.burst === "full"
    const UP = 880
    const BURST = 1400
    const CATCH = 1520
    const RES = 2350
    const END = 3100
    const HERO: Camera = {
      focus: { x: W / 2, y: H * 0.68 },
      scale: 1.6,
      tilt: 52,
    }
    const sky = { x: W / 2, y: H * 0.24 }

    k.sheet(ease.inCubic(seg(t, 0, 380)), false)
    const zoom = seg(t, 0, 950)
    const cam =
      t < RES
        ? lerpCam(k.start, HERO, ease.inOutCubic(zoom), ease.inOutQuart(zoom))
        : lerpCam(HERO, k.final, ease.inOutCubic(seg(t, RES, END)))
    k.camera(cam)
    // Night, then the burst lights the ground for a beat.
    const light = envelope(t, BURST, BURST + 140, BURST + 300, RES)
    k.scrim(
      (ease.outCubic(seg(t, 0, 600)) - 0.55 * light) *
        (1 - ease.inOutCubic(seg(t, RES, END - 80))),
      1 - 0.8 * ease.inOutCubic(seg(t, UP - 200, UP + 200))
    )
    k.tint(0.85 * light)

    k.hero({
      show: seg(t, 300, 520),
      scale:
        lerp(0.6, 1, ease.outBack(seg(t, 300, 700))) * pop(t, CATCH, 360, 0.45),
      lit: seg(t, CATCH, CATCH + 120),
      flame:
        t < RES
          ? ease.outBack(seg(t, CATCH, CATCH + 300)) * 1.15
          : 1.15 * (1 - ease.inCubic(seg(t, RES, RES + 300))),
      chip: seg(t, END - 300, END),
      t,
    })
    k.word(
      envelope(t, BURST + 30, BURST + 230, RES - 150, RES + 100),
      lerp(0.6, 1, ease.outBack(seg(t, BURST + 30, BURST + 380))),
      sky
    )
    k.text(envelope(t, CATCH + 150, CATCH + 400, RES - 100, RES + 120), 0)

    k.canvasAlpha(1 - seg(t, RES + 100, RES + 550))
    const pin = cam.focus
    const pinTop = { x: pin.x, y: pin.y - 34 }
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
        alpha: 0.3,
        salt: b / 50,
      })
    }
    if (t >= UP && t < BURST) {
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
      glow(ctx, sky, lerp(10, 120, ease.outCubic(bk)), p.cream, 0.9 * (1 - bk))
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
    ignite(ctx, t, p, pin, {
      born: CATCH,
      waves: full ? 2 : 1,
      flash: 90,
      count: 10,
      reach: [30, 60],
      life: 600,
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

export const TAKES: Record<TakeKey, Take> = { a: takeA, b: takeB, c: takeC }
