// PROTOTYPE (#371) — throwaway. GSAP timelines for the burst (the flare
// catches) and the burnout (the flare ended). GSAP itself is never imported
// statically: `loadGsap()` pulls it in with a dynamic import the first time
// a moment plays, so it stays out of every other route's JavaScript.

import type { Burnout, Burst, Colour, Who } from "./_mock"

export type Gsap = typeof import("gsap").gsap
type Timeline = ReturnType<Gsap["timeline"]>

let loading: Promise<Gsap> | null = null
export function loadGsap(): Promise<Gsap> {
  loading ??= import("gsap").then((m) => {
    // Exposed for the screenshot run, which pauses time to catch frames.
    ;(window as { __flareMotionGsap?: Gsap }).__flareMotionGsap = m.gsap
    return m.gsap
  })
  return loading
}

/** The stage's animated layers (see _stage.tsx for the stacking order). */
export type StageEls = {
  disc: SVGCircleElement
  endedDisc: SVGCircleElement
  ring: SVGCircleElement
  waves: SVGCircleElement[]
  unlit: SVGGElement
  ended: SVGGElement
  ash: SVGGElement
  lit: SVGGElement
  fuse: SVGGElement
  spark: SVGGElement
  flash: HTMLDivElement
  particles: HTMLSpanElement[]
}

/** Centre of the 256 × 256 icon space, for svg transforms. */
export const ORIGIN = "128 128"

// Colours are tokens only. Pin colours borrow --flare-invite / --flare-open.
export function sparkColours(colour: Colour, who: Who): string[] {
  const peach = [
    "var(--primary)",
    "var(--chart-1)",
    "color-mix(in oklch, var(--primary) 70%, var(--foreground))",
  ]
  if (colour === "peach") return peach
  const pin = who === "invite" ? "--flare-invite" : "--flare-open"
  return ["var(--primary)", `var(${pin})`, `var(${pin}-ink)`, "var(--chart-1)"]
}

const SPEC: Record<
  Burst,
  {
    count: number
    reach: [number, number]
    duration: number
    pop: number
    waves: number
    flash: boolean
    gravity: number
  }
> = {
  soft: {
    count: 8,
    reach: [44, 64],
    duration: 0.5,
    pop: 1,
    waves: 0,
    flash: false,
    gravity: 0,
  },
  medium: {
    count: 14,
    reach: [70, 110],
    duration: 0.7,
    pop: 1.1,
    waves: 1,
    flash: false,
    gravity: 10,
  },
  big: {
    count: 24,
    reach: [100, 165],
    duration: 0.95,
    pop: 1.2,
    waves: 2,
    flash: true,
    gravity: 34,
  },
}

/** Deterministic jitter so screenshots repeat run to run. */
function jitter(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function playBurst(
  gsap: Gsap,
  els: StageEls,
  o: { burst: Burst; colour: Colour; who: Who; reduced: boolean }
): Timeline {
  const tl = gsap.timeline()
  const fadeIn = [els.disc, els.ring, els.lit]

  if (o.reduced) {
    // Reduced motion: no travel, no scale, no particles. A short cross-fade
    // from the unlit icon to the lit one.
    tl.set(fadeIn, { scale: 1, svgOrigin: ORIGIN })
    tl.to(els.fuse, { opacity: 0, duration: 0.2 }, 0)
    tl.to(els.spark, { opacity: 0, duration: 0.2 }, 0)
    tl.to(els.unlit, { opacity: 0, duration: 0.2 }, 0)
    tl.to(fadeIn, { opacity: 1, duration: 0.2 }, 0)
    return tl
  }

  const s = SPEC[o.burst]
  const colours = sparkColours(o.colour, o.who)

  // The spark at the fuse's end flares and goes.
  tl.to(
    els.spark,
    { scale: 3, opacity: 0, duration: 0.22, ease: "power2.out" },
    0
  )
  tl.to(els.fuse, { opacity: 0, duration: 0.3 }, 0.05)
  tl.to(els.unlit, { opacity: 0, duration: 0.2 }, 0)

  // The disc and icon catch.
  tl.fromTo(
    els.disc,
    { opacity: 0, scale: 0.4, svgOrigin: ORIGIN },
    {
      opacity: 1,
      scale: 1,
      duration: o.burst === "soft" ? 0.4 : 0.55,
      ease: o.burst === "soft" ? "power2.out" : "back.out(1.7)",
    },
    0.02
  )
  tl.fromTo(
    els.lit,
    { opacity: 0, scale: 0.85, svgOrigin: ORIGIN },
    { opacity: 1, scale: s.pop, duration: 0.22, ease: "power2.out" },
    0.04
  )
  if (s.pop !== 1) {
    tl.to(els.lit, { scale: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" })
  }
  tl.fromTo(
    els.ring,
    { opacity: 0, scale: 0.85, svgOrigin: ORIGIN },
    { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" },
    0.12
  )

  // Shock waves.
  els.waves.slice(0, s.waves).forEach((wave, i) => {
    tl.fromTo(
      wave,
      { opacity: 0.8, scale: 1, svgOrigin: ORIGIN },
      { opacity: 0, scale: 1.7, duration: 0.75, ease: "power2.out" },
      0.05 + i * 0.16
    )
  })

  if (s.flash) {
    tl.fromTo(
      els.flash,
      { opacity: 0 },
      { opacity: 0.55, duration: 0.08, ease: "power1.out" },
      0
    )
    tl.to(els.flash, { opacity: 0, duration: 0.5, ease: "power2.out" }, 0.08)
  }

  // Sparks fly out from the centre.
  els.particles.forEach((p, i) => {
    if (i >= s.count) {
      gsap.set(p, { opacity: 0 })
      return
    }
    const angle = (i / s.count) * Math.PI * 2 + jitter(i, 1) * 0.5
    const reach = s.reach[0] + (s.reach[1] - s.reach[0]) * jitter(i, 2)
    const size = 5 + Math.round(jitter(i, 3) * 5)
    p.style.background = colours[i % colours.length]
    tl.fromTo(
      p,
      { x: 0, y: 0, opacity: 1, scale: 1, width: size, height: size },
      {
        x: Math.cos(angle) * reach,
        y: Math.sin(angle) * reach,
        duration: s.duration,
        ease: "power3.out",
      },
      0.04
    )
    tl.to(
      p,
      {
        y: `+=${s.gravity}`,
        opacity: 0,
        scale: 0.4,
        duration: s.duration * 0.6,
        ease: "power1.in",
      },
      0.04 + s.duration * 0.55
    )
  })

  return tl
}

export function playBurnout(
  gsap: Gsap,
  els: StageEls,
  o: { burnout: Burnout; reduced: boolean; retract: (tl: Timeline) => void }
): Timeline {
  const tl = gsap.timeline()
  const lit = [els.disc, els.ring, els.lit]

  if (o.reduced) {
    tl.to(lit, { opacity: 0, duration: 0.3 }, 0)
    tl.to([els.endedDisc, els.ended], { opacity: 1, duration: 0.3 }, 0)
    return tl
  }

  if (o.burnout === "ash") {
    // The colour drains out, the flare shrinks a touch, ash drifts up.
    tl.to(els.ring, { opacity: 0, duration: 0.35 }, 0)
    tl.to([els.disc, els.lit], { opacity: 0, duration: 0.9 }, 0)
    tl.to([els.endedDisc, els.ended], { opacity: 1, duration: 0.9 }, 0)
    tl.fromTo(
      [els.endedDisc, els.ended],
      { scale: 1, svgOrigin: ORIGIN },
      { scale: 0.94, duration: 1.2, ease: "power2.inOut" },
      0
    )
    els.particles.slice(0, 8).forEach((p, i) => {
      p.style.background = "var(--muted-foreground)"
      tl.fromTo(
        p,
        {
          x: (jitter(i, 4) - 0.5) * 120,
          y: (jitter(i, 5) - 0.5) * 60,
          opacity: 0,
          scale: 1,
          width: 4,
          height: 4,
        },
        {
          keyframes: [
            { opacity: 0.7, duration: 0.25 },
            {
              y: `-=${50 + jitter(i, 6) * 40}`,
              x: `+=${(jitter(i, 7) - 0.5) * 30}`,
              opacity: 0,
              duration: 1,
              ease: "power1.out",
            },
          ],
        },
        0.2 + i * 0.07
      )
    })
    return tl
  }

  // Ember retreats: the fuse runs back along the outline as a dying ember
  // and leaves a dotted, burnt outline behind.
  tl.to(els.ring, { opacity: 0, duration: 0.3 }, 0)
  tl.to([els.disc, els.lit], { opacity: 0, duration: 0.7 }, 0.1)
  tl.to(els.endedDisc, { opacity: 1, duration: 0.7 }, 0.1)
  o.retract(tl)
  tl.to(els.ash, { opacity: 1, duration: 1.1, ease: "power1.in" }, 0.3)
  return tl
}
