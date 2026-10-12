// PROTOTYPE (#371, round 2) — throwaway. What the three takes share: their
// props and handle, the tone colours (tokens only), the lazy GSAP loader and
// a spark helper.

import { useEffect, useId, useRef } from "react"
import type { Icon } from "@/components/icons"

export type TakeKey = "wick" | "flame" | "launch"
/** peach = the flare button's colour; invite / open = the map pin's (#315). */
export type Tone = "peach" | "invite" | "open"
export type Intensity = "soft" | "full"

export type TakeProps = {
  Icon: Icon
  tone: Tone
  intensity: Intensity
  reduced: boolean
}

/** What the page drives. Each step resolves when its motion settles. */
export type TakeHandle = {
  /** The fuse runs from the strike to the flare. */
  ignite(): Promise<void>
  /** The api is slow: the spark sputters where the fuse ended. */
  wait(): void
  /** The api confirmed the flare: it catches. */
  burst(): Promise<void>
  /** The api failed: the spark dies out. */
  fizzle(): Promise<void>
  /** The flare ended. */
  burnout(): Promise<void>
}

export type Gsap = typeof import("gsap").gsap
export type Timeline = ReturnType<Gsap["timeline"]>

let loading: Promise<Gsap> | null = null

/**
 * GSAP and DrawSVGPlugin, loaded with a dynamic import the first time a
 * moment starts (a strike begins), so neither joins any route's first-load
 * JavaScript.
 */
export function loadGsap(): Promise<Gsap> {
  loading ??= Promise.all([import("gsap"), import("gsap/DrawSVGPlugin")]).then(
    ([core, draw]) => {
      core.gsap.registerPlugin(draw.DrawSVGPlugin)
      // Exposed for the screenshot run, which pauses time to catch frames.
      ;(window as { __flareMotionGsap?: Gsap }).__flareMotionGsap = core.gsap
      return core.gsap
    }
  )
  return loading
}

export const LIT_FILL: Record<Tone, string> = {
  peach: "var(--primary)",
  invite: "var(--flare-invite)",
  open: "var(--flare-open)",
}

export const LIT_INK: Record<Tone, string> = {
  peach: "var(--primary-foreground)",
  invite: "var(--flare-invite-ink)",
  open: "var(--flare-open-ink)",
}

/** Spark colours: peach only, or peach mixed with the pin's colour. */
export function sparkColours(tone: Tone): string[] {
  if (tone === "peach") {
    return [
      "var(--primary)",
      "var(--chart-1)",
      "color-mix(in oklch, var(--primary) 70%, var(--foreground))",
    ]
  }
  const pin = tone === "invite" ? "--flare-invite" : "--flare-open"
  return ["var(--primary)", `var(${pin})`, `var(${pin}-ink)`, "var(--chart-1)"]
}

/** Deterministic jitter in [0, 1), so screenshots repeat run to run. */
export function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export const BURST = {
  soft: { count: 10, reach: [34, 58], waves: 1, pop: 1.06, glow: 0.3 },
  full: { count: 22, reach: [60, 112], waves: 2, pop: 1.16, glow: 0.5 },
} as const

/**
 * Sparks fly out from (cx, cy). `angles` limits the spread (radians), e.g.
 * upwards only for embers. Particles are svg circles parked at the centre.
 */
export function addSparks(
  gsap: Gsap,
  tl: Timeline,
  particles: SVGCircleElement[],
  o: {
    cx: number
    cy: number
    count: number
    reach: readonly [number, number]
    colours: string[]
    at: number
    gravity?: number
    angles?: [number, number]
    duration?: number
  }
) {
  const [a0, a1] = o.angles ?? [0, Math.PI * 2]
  const duration = o.duration ?? 0.75
  particles.forEach((p, i) => {
    if (i >= o.count) return
    const angle = a0 + ((a1 - a0) * (i + jitter(i, 1) * 0.6)) / o.count
    const reach = o.reach[0] + (o.reach[1] - o.reach[0]) * jitter(i, 2)
    p.style.fill = o.colours[i % o.colours.length]
    tl.fromTo(
      p,
      {
        attr: { cx: o.cx, cy: o.cy, r: 1.6 + jitter(i, 3) * 2.2 },
        x: 0,
        y: 0,
        opacity: 1,
      },
      {
        x: Math.cos(angle) * reach,
        y: Math.sin(angle) * reach,
        duration,
        ease: "power3.out",
      },
      o.at
    )
    tl.to(
      p,
      {
        y: `+=${o.gravity ?? 12}`,
        opacity: 0,
        duration: duration * 0.7,
        ease: "power1.in",
      },
      o.at + duration * 0.5
    )
  })
}

/** Little crackles thrown off the fuse's head while it burns. */
export function crackle(
  gsap: Gsap,
  pool: SVGCircleElement[],
  x: number,
  y: number,
  n: number
) {
  const p = pool[n % pool.length]
  if (!p) return
  const angle = jitter(n, 8) * Math.PI * 2
  const reach = 6 + jitter(n, 9) * 12
  gsap.fromTo(
    p,
    { attr: { cx: x, cy: y, r: 1.4 }, x: 0, y: 0, opacity: 1 },
    {
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach - 4,
      opacity: 0,
      duration: 0.35,
      ease: "power2.out",
    }
  )
}

/** A point `t` (0–1) along an svg path. */
export function pointAt(path: SVGPathElement, t: number) {
  const p = path.getPointAtLength(path.getTotalLength() * t)
  return { x: p.x, y: p.y }
}

/** Where a closed path is highest (its tip), as a share of its length. */
export function tipOf(path: SVGPathElement): number {
  const len = path.getTotalLength()
  let best = 0
  let bestY = Infinity
  for (let i = 0; i <= 200; i++) {
    const { y } = path.getPointAtLength((len * i) / 200)
    if (y < bestY) {
      bestY = y
      best = i / 200
    }
  }
  return best
}

/** Positions an html child over an svg of size w × h at (x, y). */
export function overlayAt(x: number, y: number, w: number, h: number) {
  return {
    left: `${(x / w) * 100}%`,
    top: `${(y / h) * 100}%`,
    transform: "translate(-50%, -50%)",
  } as const
}

/**
 * Element refs by key, plus a bin of running tweens that is emptied on
 * unmount (the page remounts a take to reset it).
 */
export function useStageEls() {
  const els = useRef(new Map<string, Element>())
  const running = useRef<{ kill(): unknown }[]>([])
  useEffect(() => {
    const bin = running.current
    return () => bin.forEach((t) => t.kill())
  }, [])
  return {
    ref: (key: string) => (el: Element | null) => {
      if (el) els.current.set(key, el)
      else els.current.delete(key)
    },
    get: <T extends Element = SVGElement>(key: string) =>
      els.current.get(key) as T,
    /** Numbered elements `${prefix}0`, `${prefix}1`, … in order. */
    all: <T extends Element = SVGElement>(prefix: string) =>
      [...els.current.entries()]
        .filter(([k]) => new RegExp(`^${prefix}\\d+$`).test(k))
        .sort(
          ([a], [b]) =>
            Number(a.slice(prefix.length)) - Number(b.slice(prefix.length))
        )
        .map(([, el]) => el as T),
    keep: <T extends { kill(): unknown }>(t: T): T => {
      running.current.push(t)
      return t
    },
  }
}

/** A useId that is safe inside url(#…). */
export function useSvgId(): string {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "")
}
