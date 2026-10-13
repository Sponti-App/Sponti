// Plain easing and timing helpers for the flare moments (#376). A moment
// is a pure function of time: every frame it computes where things are from
// `t`, so a frame can be drawn at any time (tests and frame grabs seek), and
// no animation library has to load before the strike.

import type { Point } from "./lighting"

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
