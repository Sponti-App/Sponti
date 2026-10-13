// The canvas side of the lighting takeover (#376): sparks, embers, smoke
// puffs and glows, drawn fresh every frame as pure functions of time. One
// canvas, no DOM per particle, so a frame stays cheap on a phone.

import { jitter, type Point } from "./lighting"
import { clamp, ease, lerp } from "./tween"

/** Brand colours, read once from the tokens so the canvas matches the theme. */
export type Palette = {
  peach: string
  ember: string
  cream: string
  smoke: string
  /** The white heart of a flash, in both themes. */
  flash: string
}

export function readPalette(el: Element, dark: boolean): Palette {
  const css = getComputedStyle(el)
  const get = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback
  return {
    peach: get("--primary", "oklch(0.8041 0.126 52.09)"),
    ember: get("--chart-1", "oklch(0.8451 0.0972 53.3)"),
    // On the light veil, cream would vanish: the warm brown of the peach ink.
    cream: dark
      ? "oklch(0.97 0.03 70)"
      : get("--accent-ink", "oklch(0.45 0.1 50)"),
    smoke: dark ? "oklch(0.93 0.012 60)" : "oklch(0.7 0.02 346)",
    flash: "oklch(0.99 0.015 80)",
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
