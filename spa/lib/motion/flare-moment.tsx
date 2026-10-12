"use client"

// The lighting moment (#375, #376): what plays once the api has confirmed a
// new flare. It is imported lazily (its own chunk, with GSAP in two more),
// drawn in a fixed layer that never takes a tap, and removes itself when done.
//
// - "launch", someone's first flare: a spark flies up one curved trail from
//   the flare button, the flare bursts (full) inside a bloom of streaks, and
//   the light goes round a tight ring of dots that pulse once and fade away.
// - "wick", every flare after: a rope runs from the flare button up to the
//   flare, the spark burns it away (nothing is left behind), and a small
//   flame catches on top of the flare's circle (soft burst).
//
// The lit flare looks like its map pin: one circle with the category icon at
// its natural 24px, filled plum (invite only) or teal (open to all). Peach is
// only for what is alight: the spark, the flame and, when the flare is live,
// the ring. Under reduced motion it is cross-fades only (lightingSteps).
//
// `burnout` is the ended state's building block (grey out, then fade away;
// no ash or ember). Nothing plays it yet: ended flares leave the map.

import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { Icon } from "@/components/icons"
import {
  BURST,
  burstFor,
  dotRing,
  jitter,
  launchPath,
  lightingSteps,
  wickPath,
  type FlareTone,
  type LightingStep,
  type LightingTake,
  type Point,
} from "./lighting"
import { loadGsap, type Gsap } from "./load-gsap"

export type FlareMomentSpec = {
  take: LightingTake
  Icon: Icon
  tone: FlareTone
  /** The flare has started: the peach live ring shows, as on the map pin. */
  live: boolean
  /** Where the fuse starts: the centre of the nav's flare button. */
  origin: Point
}

type Timeline = ReturnType<Gsap["timeline"]>

const R = 28
const KNOWN = {
  invite: { fill: "var(--flare-invite)", ink: "var(--flare-invite-ink)" },
  open: { fill: "var(--flare-open)", ink: "var(--flare-open-ink)" },
} as const
const SPARKS = ["var(--primary)", "var(--chart-1)"]
// The small flame on top of the wick's circle, base at (0, 0).
const CROWN =
  "M0 0 C-10 0 -15 -7 -14 -14 C-13 -22 -6 -26 -4 -34 C-1 -27 1 -24 3 -22 C5 -26 6 -30 6 -32 C11 -26 14 -19 14 -13 C14 -5 8 0 0 0 Z"
const CROWN_CORE =
  "M0 -1 C-5 -1 -8 -5 -7 -9 C-6 -14 -2 -17 0 -21 C2 -17 6 -14 7 -9 C8 -5 5 -1 0 -1 Z"
const STRANDS = BURST.full.sparks
const CRACKLES = 8
const DOT_RING = 62
const HOLD_S = 1

const present = <T,>(xs: (T | null | undefined)[]): T[] =>
  xs.filter((x): x is T => x != null)

function useEls() {
  const els = useRef(new Map<string, Element>())
  return {
    ref: (key: string) => (el: Element | null) => {
      if (el) els.current.set(key, el)
      else els.current.delete(key)
    },
    get: <T extends Element = SVGElement>(key: string) =>
      els.current.get(key) as T,
    list: <T extends Element = SVGElement>(prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => els.current.get(`${prefix}${i}`))
        .filter((el): el is Element => Boolean(el))
        .map((el) => el as T),
  }
}

export function FlareMoment({
  spec,
  reduced,
  onLit,
  onDone,
}: {
  spec: FlareMomentSpec
  reduced: boolean
  /** The flare caught: the moment's announcement (the toast) goes now. */
  onLit: () => void
  onDone: () => void
}) {
  const $ = useEls()
  const [size] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }))
  const center = { x: size.w / 2, y: Math.round(size.h * 0.38) }
  const sway = Math.min(size.w * 0.18, 70)
  const fusePath =
    spec.take === "wick"
      ? wickPath(spec.origin, { x: center.x, y: center.y + R }, sway)
      : launchPath(spec.origin, center, 60)
  const dots = dotRing(center, DOT_RING)
  const tone = KNOWN[spec.tone]
  const burst = BURST[burstFor(spec.take)]

  // The latest callbacks, so the one-shot effect below never re-runs.
  const callbacks = useRef({ onLit, onDone })
  useEffect(() => {
    callbacks.current = { onLit, onDone }
  })

  useEffect(() => {
    let cancelled = false
    let tl: Timeline | null = null
    const loops: { kill(): unknown }[] = []
    let lit = false
    const fireLit = () => {
      if (lit) return
      lit = true
      callbacks.current.onLit()
    }

    loadGsap()
      .then((gsap) => {
        if (cancelled) return
        tl = gsap.timeline({
          onComplete: () => callbacks.current.onDone(),
        })
        for (const step of lightingSteps(spec.take, reduced)) {
          STEPS[step]({
            gsap,
            tl,
            $,
            spec,
            reduced,
            burst,
            center,
            fireLit,
            loops,
            dots,
          })
        }
      })
      .catch(() => {
        // GSAP couldn't load: no moment, but the flare is lit, so say so.
        if (cancelled) return
        fireLit()
        callbacks.current.onDone()
      })

    return () => {
      cancelled = true
      tl?.kill()
      loops.forEach((t) => t.kill())
    }
    // The moment plays once per mount; the page remounts it per flare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const layer: CSSProperties = { width: size.w, height: size.h }

  return (
    <div
      ref={$.ref("root")}
      aria-hidden
      data-flare-moment={spec.take}
      data-reduced={reduced ? "true" : undefined}
      className="pointer-events-none fixed inset-0 z-[62]"
      style={{ opacity: 0 }}
    >
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={layer}
        className="absolute inset-0 overflow-visible"
      >
        <defs>
          <radialGradient id="flare-moment-glow">
            <stop offset="0" style={{ stopColor: "var(--primary)" }} />
            <stop
              offset="1"
              style={{ stopColor: "var(--primary)", stopOpacity: 0 }}
            />
          </radialGradient>
          <mask id="flare-moment-unburnt" maskUnits="userSpaceOnUse">
            <path
              ref={$.ref("unburnt")}
              d={fusePath}
              fill="none"
              stroke="white"
              strokeWidth={14}
            />
          </mask>
        </defs>
        <circle
          ref={$.ref("glow")}
          cx={center.x}
          cy={center.y}
          r={spec.take === "launch" ? 190 : 130}
          fill="url(#flare-moment-glow)"
          opacity={0}
        />

        {/* The fuse: the wick's rope, or the launch's trail. */}
        <path ref={$.ref("fuse")} d={fusePath} fill="none" stroke="none" />
        {spec.take === "wick" && (
          <g ref={$.ref("rope")} mask="url(#flare-moment-unburnt)" opacity={0}>
            <path
              d={fusePath}
              fill="none"
              strokeWidth={4}
              strokeLinecap="round"
              style={{ stroke: "var(--muted-foreground)" }}
              opacity={0.55}
            />
            <path
              d={fusePath}
              fill="none"
              strokeWidth={4}
              strokeDasharray="1.2 4.8"
              style={{ stroke: "var(--background)" }}
              opacity={0.85}
            />
          </g>
        )}
        <g ref={$.ref("trail")} opacity={0}>
          <path
            ref={$.ref("trailGlow")}
            d={fusePath}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            style={{ stroke: "var(--primary)" }}
            opacity={0.3}
          />
          <path
            ref={$.ref("trailLine")}
            d={fusePath}
            fill="none"
            strokeWidth={spec.take === "wick" ? 4 : 2.5}
            strokeLinecap="round"
            style={{ stroke: "var(--primary)" }}
          />
        </g>

        {/* The launch's ring of dots and its bloom. */}
        {spec.take === "launch" && (
          <g ref={$.ref("dots")} opacity={0}>
            {dots.map((d, i) => (
              <g key={i}>
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={3.5}
                  style={{ fill: "var(--muted-foreground)" }}
                  opacity={0.35}
                />
                <circle
                  ref={$.ref(`ping${i}`)}
                  cx={d.x}
                  cy={d.y}
                  r={3.5}
                  fill="none"
                  strokeWidth={1.5}
                  style={{ stroke: "var(--primary)" }}
                  opacity={0}
                />
                <circle
                  ref={$.ref(`dot${i}`)}
                  cx={d.x}
                  cy={d.y}
                  r={3.5}
                  style={{ fill: "var(--primary)" }}
                  opacity={0}
                />
              </g>
            ))}
          </g>
        )}
        {spec.take === "launch" &&
          Array.from({ length: STRANDS }, (_, i) => {
            const a = (i / STRANDS) * Math.PI * 2 + jitter(i, 4) * 0.25
            const len =
              BURST.full.reach[0] +
              (BURST.full.reach[1] - BURST.full.reach[0]) * jitter(i, 7)
            return (
              <path
                key={i}
                ref={$.ref(`strand${i}`)}
                d={`M${center.x} ${center.y} L${center.x + Math.cos(a) * len} ${center.y + Math.sin(a) * len}`}
                fill="none"
                strokeWidth={2.5}
                strokeLinecap="round"
                style={{ stroke: SPARKS[i % SPARKS.length] }}
                opacity={0}
              />
            )
          })}

        {/* The flare: waves, the live ring, its circle and the small flame. */}
        {[0, 1].map((i) => (
          <circle
            key={i}
            ref={$.ref(`wave${i}`)}
            cx={center.x}
            cy={center.y}
            r={R}
            fill="none"
            strokeWidth={2}
            style={{ stroke: "var(--primary)" }}
            opacity={0}
          />
        ))}
        <circle
          ref={$.ref("ring")}
          cx={center.x}
          cy={center.y}
          r={R + 6}
          fill="none"
          strokeWidth={2.5}
          style={{ stroke: "var(--primary)" }}
          opacity={0}
        />
        <g ref={$.ref("unlit")} opacity={0}>
          <circle
            cx={center.x}
            cy={center.y}
            r={R}
            strokeWidth={1.5}
            style={{ fill: "var(--card)", stroke: "var(--border)" }}
          />
        </g>
        <circle
          ref={$.ref("disc")}
          data-flare-moment-disc
          cx={center.x}
          cy={center.y}
          r={R}
          style={{ fill: tone.fill }}
          opacity={0}
        />
        {spec.take === "wick" && (
          <g transform={`translate(${center.x} ${center.y - R + 2})`}>
            <g ref={$.ref("crown")} opacity={0}>
              <path d={CROWN} style={{ fill: "var(--primary)" }} />
              <path d={CROWN_CORE} style={{ fill: "var(--chart-1)" }} />
            </g>
          </g>
        )}

        {/* The spark, its crackles and the burst. */}
        {Array.from({ length: CRACKLES }, (_, i) => (
          <circle
            key={i}
            ref={$.ref(`crackle${i}`)}
            cx={0}
            cy={0}
            r={0}
            opacity={0}
            style={{ fill: "var(--primary)" }}
          />
        ))}
        {Array.from({ length: STRANDS }, (_, i) => (
          <circle
            key={i}
            ref={$.ref(`particle${i}`)}
            cx={center.x}
            cy={center.y}
            r={0}
            opacity={0}
            style={{ fill: SPARKS[i % SPARKS.length] }}
          />
        ))}
        <g ref={$.ref("spark")} opacity={0}>
          <circle
            cx={0}
            cy={0}
            r={12}
            style={{ fill: "var(--primary)" }}
            opacity={0.35}
          />
          <circle cx={0} cy={0} r={4.5} style={{ fill: "var(--primary)" }} />
          <circle cx={0} cy={0} r={2} style={{ fill: "var(--chart-1)" }} />
        </g>
      </svg>

      {/* The category icon at its natural size, unlit and lit. */}
      <div
        className="absolute size-6"
        style={{
          left: center.x,
          top: center.y,
          transform: "translate(-50%, -50%)",
        }}
      >
        <span
          ref={$.ref("unlitIcon")}
          className="absolute inset-0 text-muted-foreground"
          style={{ opacity: 0 }}
        >
          <spec.Icon className="size-6" />
        </span>
        <span
          ref={$.ref("litIcon")}
          className="absolute inset-0"
          style={{ opacity: 0, color: tone.ink }}
        >
          <spec.Icon className="size-6" />
        </span>
      </div>
    </div>
  )
}

// ---- the steps ------------------------------------------------------------------

type Els = ReturnType<typeof useEls>
type StepContext = {
  gsap: Gsap
  tl: Timeline
  $: Els
  spec: FlareMomentSpec
  reduced: boolean
  burst: (typeof BURST)[keyof typeof BURST]
  center: Point
  dots: Point[]
  fireLit: () => void
  loops: { kill(): unknown }[]
}

const STEPS: Record<LightingStep, (c: StepContext) => void> = {
  fuse: playFuse,
  burst: playBurst,
  dots: playDots,
  "fade-in": playFadeIn,
  hold: ({ tl }) => {
    tl.to({}, { duration: HOLD_S })
  },
  "fade-out": ({ tl, $, reduced }) => {
    tl.to($.get("root"), { opacity: 0, duration: reduced ? 0.3 : 0.45 })
  },
}

/** The fuse runs from the flare button to the flare. */
function playFuse({ gsap, tl, $, spec }: StepContext) {
  const fuse = $.get<SVGPathElement>("fuse")
  const length = fuse.getTotalLength()
  const crackles = $.list<SVGCircleElement>("crackle", CRACKLES)
  const wick = spec.take === "wick"
  const at = (p: number) => fuse.getPointAtLength((length * p) / 100)
  const state = { p: 0 }
  let n = 0

  const place = () => {
    const p = state.p
    const tail = wick ? 6 : 30
    gsap.set($.get("unburnt"), { drawSVG: `${p}% 100%` })
    gsap.set([$.get("trailLine"), $.get("trailGlow")], {
      drawSVG: `${Math.max(0, p - tail)}% ${p}%`,
    })
    const pt = at(p)
    gsap.set($.get("spark"), { x: pt.x, y: pt.y })
    if (n++ % 3 === 0) {
      const c = crackles[n % crackles.length]
      const a = jitter(n, 8) * Math.PI * 2
      const reach = 6 + jitter(n, 9) * 12
      if (c) {
        gsap.fromTo(
          c,
          { attr: { cx: pt.x, cy: pt.y, r: 1.4 }, x: 0, y: 0, opacity: 1 },
          {
            x: Math.cos(a) * reach,
            y: Math.sin(a) * reach - 4,
            opacity: 0,
            duration: 0.35,
            ease: "power2.out",
          }
        )
      }
    }
  }

  tl.set($.get("root"), { opacity: 1 })
  tl.call(place)
  tl.to(present([$.get("unlit"), $.get("unlitIcon"), $.get("rope")]), {
    opacity: 1,
    duration: 0.2,
  })
  if (spec.take === "launch")
    tl.to($.get("dots"), { opacity: 1, duration: 0.2 }, "<")
  tl.set([$.get("trail"), $.get("spark")], { opacity: 1 })
  tl.to(state, {
    p: 100,
    duration: wick ? 0.95 : 0.8,
    ease: wick ? "sine.inOut" : "power2.out",
    onUpdate: place,
  })
  // Nothing of the fuse is left behind.
  tl.to(present([$.get("trail"), $.get("rope")]), {
    opacity: 0,
    duration: 0.25,
  })
}

/** The flare catches. */
function playBurst({
  gsap,
  tl,
  $,
  spec,
  burst,
  center,
  fireLit,
  loops,
}: StepContext) {
  const origin = `${center.x} ${center.y}`
  tl.addLabel("lit", "<")
  tl.add(fireLit, "lit")
  tl.to(
    $.get("spark"),
    { scale: 2.6, opacity: 0, duration: 0.25, ease: "power2.out" },
    "<"
  )
  const t0 = "lit"
  tl.fromTo(
    $.get("glow"),
    { opacity: 0, scale: 0.4, svgOrigin: origin },
    {
      keyframes: [
        { opacity: burst.glow, scale: 1, duration: 0.22 },
        { opacity: 0.1, duration: 0.9 },
      ],
    },
    t0
  )
  tl.fromTo(
    $.get("disc"),
    { opacity: 0, scale: 0.6, svgOrigin: origin },
    {
      keyframes: [
        { opacity: 1, scale: burst.pop, duration: 0.2, ease: "power2.out" },
        { scale: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" },
      ],
    },
    t0
  )
  tl.to(
    [$.get("unlitIcon"), $.get("unlit")],
    { opacity: 0, duration: 0.15 },
    t0
  )
  tl.fromTo(
    $.get("litIcon"),
    { opacity: 0, scale: 0.7 },
    { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" },
    t0
  )
  if (spec.take === "wick") {
    tl.fromTo(
      $.get("crown"),
      { opacity: 1, scale: 0, svgOrigin: "0 0" },
      {
        keyframes: [
          { scale: 1.3, duration: 0.22, ease: "power2.out" },
          { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.45)" },
        ],
      },
      t0
    )
  } else {
    $.list<SVGPathElement>("strand", STRANDS).forEach((s) => {
      tl.fromTo(
        s,
        { opacity: 1, drawSVG: "0% 0%" },
        {
          keyframes: [
            { drawSVG: "0% 75%", duration: 0.32, ease: "power3.out" },
            {
              drawSVG: "100% 100%",
              opacity: 0,
              duration: 0.6,
              ease: "power1.in",
            },
          ],
        },
        "lit"
      )
    })
  }
  $.list("wave", 2).forEach((wave, i) => {
    if (i >= burst.waves) return
    tl.fromTo(
      wave,
      { opacity: 0.7, scale: 1, svgOrigin: origin },
      { opacity: 0, scale: 2.1, duration: 0.8, ease: "power2.out" },
      i === 0 ? t0 : "<+=0.16"
    )
  })
  $.list<SVGCircleElement>("particle", STRANDS).forEach((p, i) => {
    if (i >= burst.sparks) return
    const a = (i / burst.sparks) * Math.PI * 2 + jitter(i, 1) * 0.5
    const reach =
      burst.reach[0] + (burst.reach[1] - burst.reach[0]) * jitter(i, 2)
    tl.fromTo(
      p,
      { attr: { r: 1.6 + jitter(i, 3) * 2.2 }, x: 0, y: 0, opacity: 1 },
      {
        keyframes: [
          {
            x: Math.cos(a) * reach,
            y: Math.sin(a) * reach,
            duration: 0.6,
            ease: "power3.out",
          },
          { y: `+=${14}`, opacity: 0, duration: 0.45, ease: "power1.in" },
        ],
      },
      t0
    )
  })
  if (spec.live) tl.to($.get("ring"), { opacity: 0.8, duration: 0.3 }, "<+=0.2")

  // Alive while it holds: the flame flickers, the live ring breathes.
  tl.add(() => {
    if (spec.take === "wick") {
      loops.push(
        gsap.to($.get("crown"), {
          scaleY: "random(0.88, 1.12)",
          scaleX: "random(0.94, 1.05)",
          skewX: "random(-6, 6)",
          svgOrigin: "0 0",
          duration: "random(0.12, 0.22)",
          ease: "sine.inOut",
          repeat: -1,
          repeatRefresh: true,
        })
      )
    }
    if (spec.live) {
      loops.push(
        gsap.fromTo(
          $.get("ring"),
          { scale: 1, opacity: 0.8, svgOrigin: origin },
          {
            scale: 1.35,
            opacity: 0,
            duration: 1.4,
            repeat: -1,
            repeatDelay: 0.4,
            ease: "power1.out",
          }
        )
      )
    }
  })
}

/** The light goes round the ring of dots; they pulse once and fade away. */
function playDots({ tl, $, reduced, dots }: StepContext) {
  const lit = $.list("dot", dots.length)
  if (reduced) {
    tl.to(lit, { opacity: 1, duration: 0.2 }, "lit")
    tl.to($.get("dots"), { opacity: 0, duration: 0.4 }, "lit+=1.2")
    return
  }
  dots.forEach((d, i) => {
    const at = `lit+=${0.12 + i * 0.09}`
    tl.fromTo(
      $.get(`ping${i}`),
      { opacity: 0.8, scale: 1, svgOrigin: `${d.x} ${d.y}` },
      { opacity: 0, scale: 2.6, duration: 0.6, ease: "power2.out" },
      at
    )
    tl.fromTo(
      lit[i],
      { opacity: 0, scale: 0.4, svgOrigin: `${d.x} ${d.y}` },
      {
        keyframes: [
          { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(3)" },
          { scale: 1.35, duration: 0.25, ease: "sine.out" },
          { scale: 1, duration: 0.3, ease: "sine.in" },
        ],
      },
      "<"
    )
  })
  tl.to(
    $.get("dots"),
    { opacity: 0, duration: 0.6, ease: "power1.in" },
    "lit+=1.6"
  )
}

/** Reduced motion: the lit flare fades in; nothing moves. */
function playFadeIn({ tl, $, spec, fireLit }: StepContext) {
  tl.set($.get("root"), { opacity: 1 })
  tl.addLabel("lit")
  tl.add(fireLit, "lit")
  const lit = present([
    $.get("disc"),
    $.get("litIcon"),
    $.get("crown"),
    spec.live ? $.get("ring") : null,
    $.get("dots"),
  ])
  tl.to(lit, { opacity: 1, duration: 0.2 }, "lit")
}

/**
 * Burnout, the ended state's building block: the small flame sinks out, the
 * flare greys out to the muted state, then fades away. No ash, smoke or
 * ember is left to clash with the map. Reduced motion: cross-fades only.
 */
export function burnout(
  gsap: Gsap,
  els: {
    lit: Element[]
    ended: Element[]
    crown?: Element | null
    origin: string
  },
  reduced: boolean
): Timeline {
  const tl = gsap.timeline()
  if (reduced) {
    tl.to(present([...els.lit, els.crown]), { opacity: 0, duration: 0.3 }, 0)
    tl.to(els.ended, { opacity: 1, duration: 0.3 }, 0)
    tl.to(els.ended, { opacity: 0, duration: 0.4 }, 1)
    return tl
  }
  if (els.crown) {
    tl.to(
      els.crown,
      {
        scaleY: 0,
        scaleX: 0.5,
        skewX: 0,
        svgOrigin: "0 0",
        duration: 0.6,
        ease: "power2.in",
      },
      0
    )
  }
  tl.to(els.lit, { opacity: 0, duration: 0.8 }, 0.3)
  tl.to(els.ended, { opacity: 1, duration: 0.8 }, 0.3)
  tl.to(
    els.ended,
    {
      opacity: 0,
      scale: 0.9,
      svgOrigin: els.origin,
      duration: 0.9,
      ease: "power1.in",
    },
    1.5
  )
  return tl
}
