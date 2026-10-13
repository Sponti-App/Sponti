// PROTOTYPE (lighting takeover) — throwaway. The moment is a pure function of
// time: every frame, a take's `render(t)` sets transforms and opacities on a
// handful of elements and redraws one canvas. Nothing is tweened, so a frame
// can be rendered at any time (the scrubber and the screenshot run seek), and
// there is no animation library to load before the moment can start.

export type Point = { x: number; y: number }

// ---- time ---------------------------------------------------------------------

export const clamp = (v: number, lo = 0, hi = 1) =>
  Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export const lerpPt = (a: Point, b: Point, k: number): Point => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
})

/** Progress (0–1) of `t` through the window [from, to] (ms). */
export const seg = (t: number, from: number, to: number) =>
  clamp((t - from) / Math.max(1, to - from))

export const ease = {
  linear: (k: number) => k,
  outCubic: (k: number) => 1 - (1 - k) ** 3,
  inCubic: (k: number) => k ** 3,
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  outQuart: (k: number) => 1 - (1 - k) ** 4,
  inOutQuart: (k: number) => (k < 0.5 ? 8 * k ** 4 : 1 - (-2 * k + 2) ** 4 / 2),
  outExpo: (k: number) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  inOutSine: (k: number) => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2
  },
}

/** Up over [a, b], hold, down over [c, d]. */
export function envelope(
  t: number,
  a: number,
  b: number,
  c: number,
  d: number
): number {
  if (t <= a || t >= d) return 0
  if (t < b) return ease.outCubic(seg(t, a, b))
  if (t <= c) return 1
  return 1 - ease.inOutCubic(seg(t, c, d))
}

/** Deterministic jitter in [0, 1), so every replay and frame grab match. */
export function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// ---- the camera -----------------------------------------------------------------

/**
 * Where the map is: the flare's map point sits at `focus` on screen, the map
 * is scaled by `scale` around it and tilted back by `tilt` degrees (a 3D map
 * view). Only the map's transform changes, so the map never re-lays out.
 */
export type Camera = { focus: Point; scale: number; tilt: number }

export const PERSPECTIVE = 900

export function cameraTransform(cam: Camera, flare: Point): string {
  const { focus, scale, tilt } = cam
  return (
    `translate3d(${focus.x}px, ${focus.y}px, 0) ` +
    (tilt ? `perspective(${PERSPECTIVE}px) rotateX(${tilt}deg) ` : "") +
    `scale(${scale}) translate(${-flare.x}px, ${-flare.y}px)`
  )
}

/** Where a map point lands on screen under the camera (with perspective). */
export function project(cam: Camera, flare: Point, p: Point): Point {
  const dx = (p.x - flare.x) * cam.scale
  const dy = (p.y - flare.y) * cam.scale
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

// ---- shapes -------------------------------------------------------------------

/** A cubic bezier from `a` to `b`, swayed sideways, sampled at `k`. */
export function fusePoint(a: Point, b: Point, sway: number, k: number): Point {
  const dy = a.y - b.y
  const c1 = { x: a.x + sway, y: a.y - dy * 0.3 }
  const c2 = { x: b.x - sway * 0.8, y: b.y + dy * 0.45 }
  const u = 1 - k
  return {
    x:
      u ** 3 * a.x + 3 * u * u * k * c1.x + 3 * u * k * k * c2.x + k ** 3 * b.x,
    y:
      u ** 3 * a.y + 3 * u * u * k * c1.y + 3 * u * k * k * c2.y + k ** 3 * b.y,
  }
}

// ---- the canvas -----------------------------------------------------------------

/** Brand colours, read once from the tokens so the canvas matches the theme. */
export type Palette = {
  peach: string
  ember: string
  cream: string
  smoke: string
}

export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el)
  const get = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback
  return {
    peach: get("--primary", "oklch(0.8041 0.126 52.09)"),
    ember: get("--chart-1", "oklch(0.8451 0.0972 53.3)"),
    cream: "oklch(0.97 0.03 70)",
    smoke: "oklch(0.93 0.012 60)",
  }
}

/** The same colour, fully transparent (so a gradient never fades via grey). */
export function clear(colour: string): string {
  const m = /^(oklch|rgb|hsl)\((.*)\)$/.exec(colour.trim())
  if (!m || m[2].includes("/")) return "transparent"
  return `${m[1]}(${m[2]} / 0)`
}

/** A soft round glow: bright core fading to nothing at radius `r`. */
export function glow(
  ctx: CanvasRenderingContext2D,
  p: Point,
  r: number,
  colour: string,
  alpha: number,
  /** Share of the radius that stays solid before the fade (0 = all soft). */
  core = 0
) {
  if (alpha <= 0.002 || r <= 0.5) return
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
  g.addColorStop(0, colour)
  if (core > 0) g.addColorStop(core, colour)
  g.addColorStop(1, clear(colour))
  ctx.globalAlpha = clamp(alpha)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
}

export function dot(
  ctx: CanvasRenderingContext2D,
  p: Point,
  r: number,
  colour: string,
  alpha: number
) {
  if (alpha <= 0.002 || r <= 0.1) return
  ctx.globalAlpha = clamp(alpha)
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
}

export function ring(
  ctx: CanvasRenderingContext2D,
  p: Point,
  r: number,
  width: number,
  colour: string,
  alpha: number
) {
  if (alpha <= 0.002 || width <= 0.1) return
  ctx.globalAlpha = clamp(alpha)
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.stroke()
}

/**
 * A burst of streaks thrown out from `at` at time `born`: each one flies out,
 * slows, falls a little and fades. Drawn as short lines along their motion.
 */
export function sparks(
  ctx: CanvasRenderingContext2D,
  t: number,
  o: {
    at: Point
    born: number
    count: number
    reach: [number, number]
    life: number
    colours: string[]
    gravity?: number
    /** Limits the spread, in radians (0 = right, -PI/2 = up). */
    angles?: [number, number]
    width?: number
    salt?: number
  }
) {
  const age = t - o.born
  if (age < 0 || age > o.life * 1.6) return
  const [a0, a1] = o.angles ?? [0, Math.PI * 2]
  const salt = o.salt ?? 1
  ctx.lineCap = "round"
  for (let i = 0; i < o.count; i++) {
    const life = o.life * (0.75 + jitter(i, salt + 4) * 0.5)
    const k = clamp(age / life)
    if (k >= 1) continue
    const angle = a0 + ((a1 - a0) * (i + jitter(i, salt) * 0.7)) / o.count
    const reach = lerp(o.reach[0], o.reach[1], jitter(i, salt + 1))
    const fall = (o.gravity ?? 30) * k * k
    const d = reach * ease.outQuart(k)
    const kPrev = Math.max(0, k - 0.06)
    const dPrev = reach * ease.outQuart(kPrev)
    const head = {
      x: o.at.x + Math.cos(angle) * d,
      y: o.at.y + Math.sin(angle) * d + fall,
    }
    const tail = {
      x: o.at.x + Math.cos(angle) * dPrev,
      y: o.at.y + Math.sin(angle) * dPrev + (o.gravity ?? 30) * kPrev * kPrev,
    }
    ctx.globalAlpha = clamp(1 - ease.inCubic(k))
    ctx.strokeStyle = o.colours[i % o.colours.length]
    ctx.lineWidth = (o.width ?? 2.4) * (1 - k * 0.6)
    ctx.beginPath()
    ctx.moveTo(tail.x, tail.y)
    ctx.lineTo(head.x, head.y)
    ctx.stroke()
  }
}

/**
 * Embers drift up from `at`, swaying and flickering, one born every
 * `every` ms from `from` to `to`.
 */
export function embers(
  ctx: CanvasRenderingContext2D,
  t: number,
  o: {
    at: Point
    from: number
    to: number
    every: number
    rise: number
    life: number
    spread: number
    colours: string[]
    alpha?: number
  }
) {
  const n = Math.floor((o.to - o.from) / o.every)
  for (let i = 0; i < n; i++) {
    const born = o.from + i * o.every
    const age = t - born
    if (age < 0 || age > o.life) continue
    const k = age / o.life
    const sway = Math.sin(age / 180 + i) * 6 * k
    const x = o.at.x + (jitter(i, 21) - 0.5) * o.spread + sway
    const y = o.at.y - o.rise * (0.6 + jitter(i, 22) * 0.4) * ease.outCubic(k)
    const flicker = 0.65 + 0.35 * Math.sin(age / 45 + i * 3)
    const a = (o.alpha ?? 1) * flicker * (1 - k) * Math.min(1, age / 120)
    dot(
      ctx,
      { x, y },
      1.2 + jitter(i, 23) * 1.4,
      o.colours[i % o.colours.length],
      a
    )
  }
}

/**
 * One smoke signal: a round puff (a few overlapping soft blobs) born at
 * `at`, rising `rise` px as it grows and thins. `born` is when it leaves.
 */
export function puff(
  ctx: CanvasRenderingContext2D,
  t: number,
  o: {
    at: Point
    born: number
    life: number
    rise: number
    r: [number, number]
    colour: string
    alpha: number
    salt: number
  }
) {
  const age = t - o.born
  if (age < 0 || age > o.life) return
  const k = age / o.life
  const r = lerp(o.r[0], o.r[1], ease.outCubic(k))
  const c = {
    x: o.at.x + Math.sin(k * 3 + o.salt) * 8 * k,
    y: o.at.y - o.rise * ease.outCubic(k),
  }
  const a = o.alpha * Math.min(1, age / 160) * (1 - ease.inCubic(k))
  // Three lobes and a core, so it reads as a puff, not a disc.
  for (let i = 0; i < 4; i++) {
    const ang = (i / 3) * Math.PI * 2 + o.salt
    const off = i === 3 ? 0 : r * 0.42
    glow(
      ctx,
      { x: c.x + Math.cos(ang) * off, y: c.y + Math.sin(ang) * off * 0.6 },
      r * (i === 3 ? 1.05 : 0.8),
      o.colour,
      a * 0.8,
      0.45
    )
  }
}
