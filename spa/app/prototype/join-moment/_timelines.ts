// PROTOTYPE (#374) — throwaway. GSAP timelines for the join moment: the three
// first-join overlays (card, arc, banner), the later-join puff, and the
// bell's reaction. GSAP is never imported statically: `loadGsap()` pulls it
// in with a dynamic import the first time a moment plays, so it stays out of
// every other route's JavaScript.
//
// Every timeline is built up front (no tweens created from callbacks), so
// the screenshot run can pause the master timeline and seek to any frame.

import type { Length, Overlay } from "./_mock"
import { TIMING } from "./_mock"

export type Gsap = typeof import("gsap").gsap
export type Timeline = ReturnType<Gsap["timeline"]>

let loading: Promise<Gsap> | null = null
export function loadGsap(): Promise<Gsap> {
  loading ??= import("gsap").then((m) => {
    // Exposed for the screenshot run, which slows or pauses time.
    ;(window as { __joinMomentGsap?: Gsap }).__joinMomentGsap = m.gsap
    return m.gsap
  })
  return loading
}

export type Pt = { x: number; y: number }

/** Centre of `el`, in the stage's coordinates. */
export function centreIn(el: Element, stage: Element): Pt {
  const r = el.getBoundingClientRect()
  const s = stage.getBoundingClientRect()
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 }
}

/** The overlay's animated layers (see _overlays.tsx). */
export type OverlayEls = {
  /** The moving body: the card, the arc's avatar group, or the banner. */
  body: HTMLElement
  /** What fades before the body flies (text, or the arc's label). */
  content: HTMLElement
  /** Card: a peach layer over the card. Banner: the falling dot. */
  ember: HTMLElement | null
  /** Arc: the ring that pulses out of the avatar. */
  ring: HTMLElement | null
  /** Where the arc's avatars start (its centre). */
  anchor: HTMLElement | null
  sparks: HTMLElement[]
}

/** What the moment lands on: the bell, or the going row in the sheet. */
export type TargetEls = {
  /** The element that swings (the bell icon) or pops (the going slot). */
  hit: HTMLElement
  ripple: HTMLElement | null
  badge: HTMLElement | null
  kind: "bell" | "slot"
}

const SPARKS = 10

// --- first join -----------------------------------------------------------

export function buildFirst(
  gsap: Gsap,
  overlay: Overlay,
  length: Length,
  reduced: boolean,
  els: OverlayEls,
  stage: HTMLElement,
  target: TargetEls,
  onImpact: () => void
): Timeline {
  const T = TIMING[length]
  const tl = gsap.timeline({ defaults: { lazy: false } })
  const to = centreIn(target.hit, stage)

  if (reduced) {
    // No travel, no scale: the overlay fades in where it is, stays long
    // enough to read, fades out, and the badge simply appears.
    gsap.set(els.body, { opacity: 0, x: 0, y: 0, scale: 1, yPercent: 0 })
    gsap.set(els.content, { opacity: 1, y: 0 })
    tl.to(els.body, { opacity: 1, duration: 0.2, ease: "none" })
    tl.to({}, { duration: T.in + T.hold + T.fly })
    tl.addLabel("impact")
    tl.call(onImpact)
    tl.to(els.body, { opacity: 0, duration: 0.25, ease: "none" }, "impact")
    tl.add(buildHit(gsap, target, true), "impact")
    return tl
  }

  if (overlay === "card") {
    const from = centreIn(els.body, stage)
    const { width, height } = els.body.getBoundingClientRect()
    const dot = 14
    tl.fromTo(
      els.body,
      { y: -140, opacity: 0 },
      { y: 0, opacity: 1, duration: T.in, ease: "back.out(1.5)" }
    )
    tl.to({}, { duration: T.hold })
    tl.addLabel("fly")
    // The card condenses into a peach ember where it is, then the ember
    // drops into the target (x drifts, y falls with gravity).
    const shrink = T.fly * 0.4
    const drop = T.fly - shrink
    tl.to(els.content, { opacity: 0, duration: 0.1, ease: "none" }, "fly")
    tl.to(
      els.body,
      {
        scaleX: dot / width,
        scaleY: dot / height,
        borderRadius: "50%",
        duration: shrink,
        ease: "power2.in",
      },
      "fly"
    )
    if (els.ember)
      tl.to(
        els.ember,
        { opacity: 1, duration: shrink * 0.7, ease: "power1.in" },
        `fly+=${shrink * 0.3}`
      )
    tl.to(
      els.body,
      { x: to.x - from.x, duration: drop, ease: "power1.out" },
      `fly+=${shrink}`
    )
    tl.to(
      els.body,
      { y: to.y - from.y, duration: drop, ease: "power2.in" },
      "<"
    )
    tl.addLabel("impact")
    tl.call(onImpact)
    tl.to(els.body, { opacity: 0, duration: T.land, ease: "none" }, "impact")
    tl.add(buildHit(gsap, target, false), "impact")
    return tl
  }

  if (overlay === "arc") {
    const from = centreIn(els.anchor ?? els.body, stage)
    tl.fromTo(
      els.body,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: T.in, ease: "back.out(2.2)" }
    )
    if (els.ring)
      tl.fromTo(
        els.ring,
        { scale: 1, opacity: 0.7 },
        { scale: 1.9, opacity: 0, duration: 0.6, ease: "power2.out" },
        "<0.08"
      )
    tl.fromTo(
      els.content,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.25, ease: "power2.out" },
      "<"
    )
    // The ring and label overlap the pop, so the hold counts from its end.
    tl.addLabel("fly", T.in + T.hold)
    tl.to(els.content, { opacity: 0, duration: 0.15, ease: "none" }, "fly")
    // A quadratic curve that swings out to the right, then drops onto the
    // target, leaving a trail of sparks.
    const ctrl = {
      x: Math.max(from.x, to.x) + 110,
      y: from.y + (to.y - from.y) * 0.25,
    }
    const at = (p: number): Pt => ({
      x: (1 - p) ** 2 * from.x + 2 * (1 - p) * p * ctrl.x + p ** 2 * to.x,
      y: (1 - p) ** 2 * from.y + 2 * (1 - p) * p * ctrl.y + p ** 2 * to.y,
    })
    const prog = { p: 0 }
    tl.to(
      prog,
      {
        p: 1,
        duration: T.fly,
        ease: "power2.in",
        onUpdate: () => {
          const pt = at(prog.p)
          gsap.set(els.body, {
            x: pt.x - from.x,
            y: pt.y - from.y,
            scale: 1 - 0.78 * prog.p,
          })
        },
      },
      "fly"
    )
    // Spark i drops where the avatar is at progress p_i. With power2.in the
    // avatar reaches p at time T * sqrt(p).
    els.sparks.slice(0, SPARKS).forEach((spark, i) => {
      const p = (i + 1) / (SPARKS + 1)
      const pt = at(p)
      tl.fromTo(
        spark,
        { x: pt.x, y: pt.y, scale: 1.2, opacity: 1 },
        {
          y: pt.y + 14,
          scale: 0,
          opacity: 0,
          duration: 0.45,
          ease: "power1.out",
          immediateRender: false,
        },
        `fly+=${T.fly * Math.sqrt(p)}`
      )
    })
    tl.addLabel("impact", `fly+=${T.fly}`)
    tl.call(onImpact, [], "impact")
    tl.to(els.body, { opacity: 0, duration: 0.08, ease: "none" }, "impact")
    tl.add(buildHit(gsap, target, false), "impact")
    return tl
  }

  // banner: slides down from the top edge, holds, slides back up and drops
  // a peach ember into the target.
  tl.fromTo(
    els.body,
    { yPercent: -110, opacity: 1 },
    { yPercent: 0, duration: T.in, ease: "power3.out" }
  )
  tl.to({}, { duration: T.hold })
  tl.addLabel("fly")
  tl.to(
    els.body,
    { yPercent: -110, duration: T.fly * 0.55, ease: "power2.in" },
    "fly"
  )
  if (els.ember && els.anchor) {
    const from = centreIn(els.anchor, stage)
    tl.fromTo(
      els.ember,
      { x: from.x, y: from.y, scale: 0, opacity: 1 },
      { scale: 1, duration: 0.12, ease: "back.out(3)", immediateRender: false },
      "fly"
    )
    // x drifts, y falls with gravity, so the ember arcs into the target.
    tl.to(
      els.ember,
      { x: to.x, duration: T.fly, ease: "power1.out" },
      "fly+=0.04"
    )
    tl.to(els.ember, { y: to.y, duration: T.fly, ease: "power2.in" }, "<")
    els.sparks.slice(0, 4).forEach((spark, i) => {
      const lag = 0.06 * (i + 1)
      tl.fromTo(
        spark,
        { x: from.x, y: from.y, scale: 0.9, opacity: 0.9 },
        {
          x: to.x,
          duration: T.fly,
          ease: "power1.out",
          immediateRender: false,
        },
        `fly+=${0.04 + lag}`
      )
      tl.to(spark, { y: to.y, duration: T.fly, ease: "power2.in" }, "<")
      tl.to(
        spark,
        { scale: 0, opacity: 0, duration: T.fly, ease: "power1.in" },
        "<"
      )
    })
    tl.addLabel("impact", `fly+=${0.04 + T.fly}`)
    tl.to(els.ember, { opacity: 0, duration: 0.08, ease: "none" }, "impact")
  } else {
    tl.addLabel("impact")
  }
  tl.call(onImpact, [], "impact")
  tl.add(buildHit(gsap, target, false), "impact")
  return tl
}

// --- later joins ----------------------------------------------------------

/** A tiny avatar pops above the target and drops into it. */
export function buildPuff(
  gsap: Gsap,
  puff: HTMLElement,
  stage: HTMLElement,
  target: TargetEls,
  reduced: boolean,
  onImpact: () => void
): Timeline {
  const tl = gsap.timeline({ defaults: { lazy: false } })
  if (reduced) {
    tl.call(onImpact)
    tl.add(buildHit(gsap, target, true))
    return tl
  }
  const to = centreIn(target.hit, stage)
  tl.fromTo(
    puff,
    { x: to.x, y: to.y - 30, scale: 0, opacity: 0 },
    {
      immediateRender: false,
      y: to.y - 44,
      scale: 1,
      opacity: 1,
      duration: 0.22,
      ease: "back.out(2.5)",
    }
  )
  tl.to({}, { duration: 0.18 })
  tl.to(puff, {
    y: to.y,
    scale: 0.3,
    duration: 0.26,
    ease: "power2.in",
  })
  tl.addLabel("impact")
  tl.call(onImpact)
  tl.to(puff, { opacity: 0, duration: 0.06, ease: "none" }, "impact")
  tl.add(buildHit(gsap, target, false), "impact")
  return tl
}

/** Just the bell (or slot) reacting: swing, ripple, badge. */
export function buildSwing(
  gsap: Gsap,
  target: TargetEls,
  reduced: boolean,
  onImpact: () => void
): Timeline {
  const tl = gsap.timeline({ defaults: { lazy: false } })
  tl.call(onImpact)
  tl.add(buildHit(gsap, target, reduced))
  return tl
}

// --- the target reacting --------------------------------------------------

export function buildHit(
  gsap: Gsap,
  target: TargetEls,
  reduced: boolean
): Timeline {
  const tl = gsap.timeline({ defaults: { lazy: false } })
  if (reduced) {
    if (target.badge)
      tl.fromTo(
        target.badge,
        { opacity: 0, scale: 1 },
        { opacity: 1, duration: 0.2, ease: "none", immediateRender: false }
      )
    return tl
  }
  if (target.kind === "bell") {
    tl.fromTo(
      target.hit,
      { rotation: 0 },
      {
        keyframes: { rotation: [0, -22, 18, -12, 7, -3, 0] },
        duration: 0.75,
        ease: "none",
        transformOrigin: "50% 12%",
        immediateRender: false,
      }
    )
  } else {
    tl.fromTo(
      target.hit,
      { scale: 0.6 },
      { scale: 1, duration: 0.4, ease: "back.out(3)", immediateRender: false }
    )
  }
  if (target.ripple)
    tl.fromTo(
      target.ripple,
      { scale: 0.5, opacity: 0.6 },
      {
        scale: 1.8,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        immediateRender: false,
      },
      0
    )
  if (target.badge)
    tl.fromTo(
      target.badge,
      { scale: 0, opacity: 1 },
      { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false },
      0.08
    )
  return tl
}
