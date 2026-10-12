"use client"

// PROTOTYPE (#371, round 2) — throwaway. Take A, "wick", for every flare
// after the first: one rope runs from the strike strip up to the flare. The
// spark eats the rope and leaves nothing behind, then a small flame catches
// on top of the flare's circle. Burnout: the flame sinks out, the flare greys
// to the muted state and fades away. No ash, smoke or ember, so nothing is
// left to clash with the map underneath.

import { forwardRef, useImperativeHandle } from "react"
import { IconLayer } from "./_icon"
import {
  addSparks,
  BURST,
  crackle,
  LIT_FILL,
  LIT_INK,
  loadGsap,
  pointAt,
  sparkColours,
  useStageEls,
  useSvgId,
  type TakeHandle,
  type TakeProps,
} from "./_shared"

const W = 320
const H = 400
const CX = 160
const CY = 96
const R = 28

const WICK =
  "M300 398 C300 344 232 336 204 306 C168 268 252 226 212 186 C188 162 160 156 160 124"
const CROWN =
  "M160 70 C150 70 145 63 146 56 C147 48 154 44 156 36 C159 43 161 46 163 48 C165 44 166 40 166 38 C171 44 174 51 174 57 C174 65 168 70 160 70 Z"
const CROWN_CORE =
  "M160 69 C155 69 152 65 153 61 C154 56 158 53 160 49 C162 53 166 56 167 61 C168 65 165 69 160 69 Z"
const CROWN_ORIGIN = "160 70"
const DISC_ORIGIN = `${CX} ${CY}`

export const WickTake = forwardRef<TakeHandle, TakeProps>(function WickTake(
  { Icon, tone, intensity, reduced },
  handle
) {
  const $ = useStageEls()
  const id = useSvgId()
  const spec = BURST[intensity]

  /** Moves the burn to p (0–100) along the wick. */
  const burnTo = (
    gsap: Awaited<ReturnType<typeof loadGsap>>,
    p: number,
    ember = 8
  ) => {
    const wick = $.get<SVGPathElement>("wick")
    gsap.set($.get("unburnt"), { drawSVG: `${p}% 100%` })
    gsap.set([$.get("ember"), $.get("emberGlow")], {
      drawSVG: `${Math.max(0, p - ember)}% ${p}%`,
    })
    const pt = pointAt(wick, p / 100)
    gsap.set($.get("spark"), { x: pt.x, y: pt.y })
    return pt
  }

  useImperativeHandle(handle, () => ({
    async ignite() {
      const gsap = await loadGsap()
      if (reduced) {
        // No travel: the rope fades out in place.
        const tl = $.keep(gsap.timeline())
        tl.to($.get("rope"), { opacity: 0, duration: 0.2 }, 0)
        await tl
        return
      }
      gsap.set([$.get("emberLayer"), $.get("spark")], {
        opacity: 1,
      })
      burnTo(gsap, 0)
      const state = { p: 0 }
      let n = 0
      const tl = $.keep(
        gsap.to(state, {
          p: 100,
          duration: 1.3,
          ease: "sine.inOut",
          onUpdate: () => {
            const pt = burnTo(gsap, state.p)
            if (n++ % 3 === 0) crackle(gsap, $.all("crk"), pt.x, pt.y, n)
          },
        })
      )
      await tl
    },

    wait() {
      if (reduced) return
      void loadGsap().then((gsap) => {
        $.keep(
          gsap.to($.get("sparkGlow"), {
            scale: 1.8,
            opacity: 0.15,
            duration: 0.35,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          })
        )
      })
    },

    async burst() {
      const gsap = await loadGsap()
      gsap.killTweensOf($.get("sparkGlow"))
      const tl = $.keep(gsap.timeline())
      const lit = [$.get("litDisc"), $.get("crown"), $.get("ring")]

      if (reduced) {
        gsap.set(lit, { scale: 1, svgOrigin: DISC_ORIGIN })
        tl.to(lit, { opacity: 1, duration: 0.2 }, 0)
        tl.to($.get("litIcon"), { opacity: 1, duration: 0.2 }, 0)
        tl.to($.get("unlitIcon"), { opacity: 0, duration: 0.2 }, 0)
        await tl
        return
      }

      tl.to(
        $.get("spark"),
        { scale: 2.6, opacity: 0, duration: 0.25, ease: "power2.out" },
        0
      )
      tl.to($.get("emberLayer"), { opacity: 0, duration: 0.3 }, 0)
      tl.fromTo(
        $.get("glow"),
        { opacity: 0, scale: 0.4, svgOrigin: DISC_ORIGIN },
        {
          keyframes: [
            { opacity: spec.glow, scale: 1, duration: 0.2 },
            { opacity: 0.12, duration: 0.9 },
          ],
        },
        0
      )
      tl.fromTo(
        $.get("litDisc"),
        { opacity: 0, scale: 0.7, svgOrigin: DISC_ORIGIN },
        {
          keyframes: [
            { opacity: 1, scale: spec.pop, duration: 0.2, ease: "power2.out" },
            { scale: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" },
          ],
        },
        0.02
      )
      tl.to($.get("unlitIcon"), { opacity: 0, duration: 0.15 }, 0.02)
      tl.fromTo(
        $.get("litIcon"),
        { opacity: 0, scale: 0.7 },
        { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" },
        0.04
      )
      // The flame catches on top of the circle.
      tl.fromTo(
        $.get("crown"),
        { opacity: 1, scale: 0, svgOrigin: CROWN_ORIGIN },
        {
          keyframes: [
            { scale: 1.35, duration: 0.22, ease: "power2.out" },
            { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.45)" },
          ],
        },
        0.08
      )
      $.all("wave").forEach((wave, i) => {
        if (i >= spec.waves) return
        tl.fromTo(
          wave,
          { opacity: 0.7, scale: 1, svgOrigin: DISC_ORIGIN },
          { opacity: 0, scale: 2.1, duration: 0.8, ease: "power2.out" },
          0.04 + i * 0.16
        )
      })
      addSparks(gsap, tl, $.all("p"), {
        cx: CX,
        cy: CY,
        count: spec.count,
        reach: spec.reach,
        colours: sparkColours(tone),
        at: 0.04,
        gravity: 14,
      })
      tl.fromTo(
        $.get("ring"),
        { opacity: 0 },
        { opacity: 0.8, duration: 0.3 },
        0.3
      )
      await tl
      // Alive while lit: the flame flickers and the live ring breathes.
      $.keep(
        gsap.to($.get("crown"), {
          scaleY: "random(0.88, 1.12)",
          scaleX: "random(0.94, 1.05)",
          skewX: "random(-6, 6)",
          svgOrigin: CROWN_ORIGIN,
          duration: "random(0.12, 0.22)",
          ease: "sine.inOut",
          repeat: -1,
          repeatRefresh: true,
        })
      )
      $.keep(
        gsap.fromTo(
          $.get("ring"),
          { scale: 1, opacity: 0.8, svgOrigin: DISC_ORIGIN },
          {
            scale: 1.35,
            opacity: 0,
            duration: 1.4,
            repeat: -1,
            repeatDelay: 0.5,
            ease: "power1.out",
          }
        )
      )
    },

    async fizzle() {
      const gsap = await loadGsap()
      gsap.killTweensOf($.get("sparkGlow"))
      const tl = $.keep(gsap.timeline())
      tl.to($.get("spark"), { scale: 0, opacity: 0, duration: 0.35 }, 0)
      tl.to($.get("emberLayer"), { opacity: 0, duration: 0.35 }, 0)
      await tl
    },

    async burnout() {
      const gsap = await loadGsap()
      gsap.killTweensOf([$.get("crown"), $.get("ring")])
      const tl = $.keep(gsap.timeline())
      const lit = [$.get("litDisc"), $.get("litIcon"), $.get("ring")]
      const ended = [$.get("endedDisc"), $.get("unlitIcon")]
      const all = [...ended, $.get("baseDisc")]

      if (reduced) {
        // Cross-fades only: lit to muted, then muted to nothing.
        tl.to(
          [...lit, $.get("crown"), $.get("glow")],
          { opacity: 0, duration: 0.3 },
          0
        )
        tl.to(ended, { opacity: 1, duration: 0.3 }, 0)
        tl.to(all, { opacity: 0, duration: 0.4 }, 1)
        await tl
        return
      }

      // The flame sinks out.
      tl.to(
        $.get("crown"),
        {
          scaleY: 0,
          scaleX: 0.5,
          skewX: 0,
          svgOrigin: CROWN_ORIGIN,
          duration: 0.6,
          ease: "power2.in",
        },
        0
      )
      // The flare greys out to the muted state…
      tl.to([...lit, $.get("glow")], { opacity: 0, duration: 0.8 }, 0.3)
      tl.to(ended, { opacity: 1, duration: 0.8 }, 0.3)
      // …and fades away.
      tl.to(
        all,
        {
          opacity: 0,
          scale: 0.9,
          svgOrigin: DISC_ORIGIN,
          duration: 0.9,
          ease: "power1.in",
        },
        1.5
      )
      await tl
    },
  }))

  return (
    <div
      className="relative mx-auto w-full"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        <defs>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" style={{ stopColor: LIT_FILL[tone] }} />
            <stop
              offset="1"
              style={{ stopColor: LIT_FILL[tone], stopOpacity: 0 }}
            />
          </radialGradient>
          <mask id={`${id}-unburnt`} maskUnits="userSpaceOnUse">
            <path
              ref={$.ref("unburnt")}
              d={WICK}
              fill="none"
              stroke="white"
              strokeWidth={14}
            />
          </mask>
        </defs>
        {/* The sky glow behind the flare. */}
        <circle
          ref={$.ref("glow")}
          cx={CX}
          cy={CY}
          r={130}
          fill={`url(#${id}-glow)`}
          opacity={0}
        />
        {/* The rope: a strand with twist notches, cut away by the burn. */}
        <path ref={$.ref("wick")} d={WICK} fill="none" stroke="none" />
        <g ref={$.ref("rope")} mask={`url(#${id}-unburnt)`}>
          <path
            d={WICK}
            fill="none"
            strokeWidth={4}
            strokeLinecap="round"
            style={{ stroke: "var(--muted-foreground)" }}
            opacity={0.55}
          />
          <path
            d={WICK}
            fill="none"
            strokeWidth={4}
            strokeDasharray="1.2 4.8"
            style={{ stroke: "var(--background)" }}
            opacity={0.85}
          />
        </g>
        <g ref={$.ref("emberLayer")} opacity={0}>
          <path
            ref={$.ref("emberGlow")}
            d={WICK}
            fill="none"
            strokeWidth={11}
            strokeLinecap="round"
            style={{ stroke: "var(--primary)" }}
            opacity={0.3}
          />
          <path
            ref={$.ref("ember")}
            d={WICK}
            fill="none"
            strokeWidth={4}
            strokeLinecap="round"
            style={{ stroke: "var(--primary)" }}
          />
        </g>

        {/* The flare: a circle, its flame, the live ring and the waves. */}
        {[0, 1].map((i) => (
          <circle
            key={i}
            ref={$.ref(`wave${i}`)}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={2}
            style={{ stroke: "var(--primary)" }}
            opacity={0}
          />
        ))}
        <circle
          ref={$.ref("ring")}
          cx={CX}
          cy={CY}
          r={R + 6}
          fill="none"
          strokeWidth={2.5}
          style={{ stroke: "var(--primary)" }}
          opacity={0}
        />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          ref={$.ref("baseDisc")}
          strokeWidth={1.5}
          style={{ fill: "var(--card)", stroke: "var(--border)" }}
        />
        <circle
          ref={$.ref("endedDisc")}
          cx={CX}
          cy={CY}
          r={R}
          style={{ fill: "var(--muted)" }}
          opacity={0}
        />
        <circle
          ref={$.ref("litDisc")}
          cx={CX}
          cy={CY}
          r={R}
          style={{ fill: LIT_FILL[tone] }}
          opacity={0}
        />
        <g ref={$.ref("crown")} opacity={0}>
          <path d={CROWN} style={{ fill: "var(--primary)" }} />
          <path d={CROWN_CORE} style={{ fill: "var(--chart-1)" }} />
        </g>

        {/* The fuse's head, its crackles and the burst's sparks. */}
        {Array.from({ length: 8 }, (_, i) => (
          <circle
            cx={0}
            cy={0}
            key={i}
            ref={$.ref(`crk${i}`)}
            r={0}
            opacity={0}
            style={{ fill: "var(--primary)" }}
          />
        ))}
        {Array.from({ length: 24 }, (_, i) => (
          <circle
            key={i}
            ref={$.ref(`p${i}`)}
            cx={CX}
            cy={CY}
            r={0}
            opacity={0}
          />
        ))}
        <g ref={$.ref("spark")} opacity={0}>
          <circle
            cx={0}
            cy={0}
            ref={$.ref("sparkGlow")}
            r={12}
            style={{ fill: "var(--primary)" }}
            opacity={0.35}
          />
          <circle cx={0} cy={0} r={4.5} style={{ fill: "var(--primary)" }} />
          <circle cx={0} cy={0} r={2} style={{ fill: "var(--chart-1)" }} />
        </g>
      </svg>
      <IconLayer
        Icon={Icon}
        x={CX}
        y={CY}
        w={W}
        h={H}
        litColour={LIT_INK[tone]}
        litRef={$.ref("litIcon")}
        unlitRef={$.ref("unlitIcon")}
      />
    </div>
  )
})
