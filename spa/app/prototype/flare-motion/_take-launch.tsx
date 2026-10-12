"use client"

// PROTOTYPE (#371, round 2) — throwaway. Take C, "launch", for someone's
// first flare: a real signal flare. The strike sends a spark up from the
// strip on one curved trail; at the top it bursts into a bloom of streaks
// around the flare's circle, and the light reaches a tight ring of dots and
// lights them one by one. The dots are abstract (evenly spaced, close to the
// circle, never where anyone is): they pulse once, then fade away, so they
// never stay as markers. Burnout is take A's: grey out, then fade away.

import { forwardRef, useImperativeHandle } from "react"
import { IconLayer } from "./_icon"
import {
  BURST,
  crackle,
  jitter,
  LIT_FILL,
  LIT_INK,
  loadGsap,
  pointAt,
  sparkColours,
  useStageEls,
  useSvgId,
  type Gsap,
  type TakeHandle,
  type TakeProps,
} from "./_shared"

const W = 320
const H = 400
const CX = 160
const CY = 130
const R = 26
const ORIGIN = `${CX} ${CY}`

const TRAIL = "M300 404 C304 320 250 210 160 130"
/** Five dots on a tight, even ring around the circle. */
const DOT_RING = 62
const FRIENDS = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 5) * Math.PI * 2
  return [CX + Math.cos(a) * DOT_RING, CY + Math.sin(a) * DOT_RING] as const
})
const BLOOM = {
  soft: { count: 10, len: [44, 62] },
  full: { count: 18, len: [74, 118] },
} as const
const MAX_STRANDS = 18

function strand(i: number, count: number, len: number) {
  const a = (i / count) * Math.PI * 2 + jitter(i, 4) * 0.25
  return `M${CX} ${CY} L${CX + Math.cos(a) * len} ${CY + Math.sin(a) * len}`
}

export const LaunchTake = forwardRef<TakeHandle, TakeProps>(function LaunchTake(
  { Icon, tone, intensity, reduced },
  handle
) {
  const $ = useStageEls()
  const id = useSvgId()
  const spec = BURST[intensity]
  const bloom = BLOOM[intensity]
  const colours = sparkColours(tone)

  const flyTo = (gsap: Gsap, t: number, tail = 0.35) => {
    const pt = pointAt($.get<SVGPathElement>("trail"), t)
    gsap.set([$.get("trailLine"), $.get("trailGlow")], {
      drawSVG: `${Math.max(0, t - tail) * 100}% ${t * 100}%`,
    })
    gsap.set($.get("spark"), { x: pt.x, y: pt.y })
    return pt
  }

  /** The light goes round the ring, one dot after the other. */
  const friendDelay = (i: number) => 0.1 + i * 0.09

  useImperativeHandle(handle, () => ({
    async ignite() {
      const gsap = await loadGsap()
      const tl = $.keep(gsap.timeline())
      if (reduced) {
        gsap.set([$.get("trailLine"), $.get("trailGlow")], {
          drawSVG: "0% 100%",
        })
        tl.to($.get("trailLayer"), { opacity: 0.5, duration: 0.2 })
        await tl
        return
      }
      flyTo(gsap, 0)
      gsap.set([$.get("trailLayer"), $.get("spark")], { opacity: 1 })
      const state = { t: 0 }
      let n = 0
      tl.to(state, {
        t: 1,
        duration: 0.95,
        ease: "power2.out",
        onUpdate: () => {
          const pt = flyTo(gsap, state.t)
          if (n++ % 2 === 0) crackle(gsap, $.all("crk"), pt.x, pt.y, n)
        },
      })
      // The trail burns out behind the spark.
      tl.to([$.get("trailLine"), $.get("trailGlow")], {
        drawSVG: "100% 100%",
        duration: 0.3,
        ease: "power1.in",
      })
      await tl
    },

    wait() {
      if (reduced) return
      void loadGsap().then((gsap) => {
        $.keep(
          gsap.to($.get("sparkGlow"), {
            scale: 1.9,
            opacity: 0.12,
            duration: 0.3,
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
      const strands = $.all("strand").slice(0, bloom.count)
      const dots = $.all("lit")

      if (reduced) {
        tl.to($.get("trailLayer"), { opacity: 0, duration: 0.2 }, 0)
        tl.to(
          [$.get("litDisc"), $.get("litIcon"), $.get("ring"), ...dots],
          { opacity: 1, duration: 0.2 },
          0
        )
        tl.to(
          [$.get("unlitIcon"), $.get("dashed")],
          { opacity: 0, duration: 0.2 },
          0
        )
        // The dots fade away again; only the flare stays.
        tl.to([...dots, $.get("dots")], { opacity: 0, duration: 0.4 }, 1.2)
        await tl
        return
      }

      tl.to(
        $.get("spark"),
        { scale: 3, opacity: 0, duration: 0.25, ease: "power2.out" },
        0
      )
      tl.fromTo(
        $.get("sky"),
        { opacity: 0, scale: 0.3, svgOrigin: ORIGIN },
        {
          keyframes: [
            { opacity: spec.glow, scale: 1, duration: 0.25 },
            { opacity: 0.1, duration: 1.2 },
          ],
        },
        0
      )
      tl.to($.get("dashed"), { opacity: 0, duration: 0.2 }, 0)
      tl.set($.get("trailLayer"), { opacity: 0 }, 0)
      tl.fromTo(
        $.get("litDisc"),
        { opacity: 0, scale: 0.5, svgOrigin: ORIGIN },
        {
          keyframes: [
            {
              opacity: 1,
              scale: spec.pop,
              duration: 0.22,
              ease: "power2.out",
            },
            { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" },
          ],
        },
        0.03
      )
      tl.to($.get("unlitIcon"), { opacity: 0, duration: 0.15 }, 0.03)
      tl.fromTo(
        $.get("litIcon"),
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.6)" },
        0.05
      )
      // The bloom: streaks fly out and burn down to their tips.
      strands.forEach((s, i) => {
        ;(s as SVGPathElement).style.stroke = colours[i % colours.length]
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
          0.04 + jitter(i, 5) * 0.06
        )
      })
      // Glitter falls from the streaks' tips.
      $.all<SVGCircleElement>("p").forEach((p, i) => {
        if (i >= bloom.count) return
        const s = strands[i] as SVGPathElement
        const end = s.getPointAtLength(s.getTotalLength())
        p.style.fill = colours[(i + 1) % colours.length]
        tl.fromTo(
          p,
          { attr: { cx: end.x, cy: end.y, r: 1.8 }, x: 0, y: 0, opacity: 0 },
          {
            keyframes: [
              { opacity: 1, duration: 0.05 },
              {
                y: 22 + jitter(i, 6) * 18,
                opacity: 0,
                duration: 0.9,
                ease: "power1.in",
              },
            ],
          },
          0.4
        )
      })
      $.all("wave").forEach((wave, i) => {
        if (i >= spec.waves) return
        tl.fromTo(
          wave,
          { opacity: 0.7, scale: 1, svgOrigin: ORIGIN },
          { opacity: 0, scale: 2.3, duration: 0.85, ease: "power2.out" },
          0.04 + i * 0.16
        )
      })
      // The light goes round the ring: each dot pings, lights, pulses once,
      // then every dot fades away. Nothing stays behind as a marker.
      FRIENDS.forEach(([x, y], i) => {
        const at = 0.12 + friendDelay(i)
        tl.fromTo(
          $.get(`ping${i}`),
          { opacity: 0.8, scale: 1, svgOrigin: `${x} ${y}` },
          { opacity: 0, scale: 2.6, duration: 0.6, ease: "power2.out" },
          at
        )
        tl.fromTo(
          $.get(`lit${i}`),
          { opacity: 0, scale: 0.4, svgOrigin: `${x} ${y}` },
          {
            keyframes: [
              { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(3)" },
              { scale: 1.35, duration: 0.25, ease: "sine.out" },
              { scale: 1, duration: 0.3, ease: "sine.in" },
            ],
          },
          at
        )
      })
      tl.to(
        [...dots, $.get("dots")],
        { opacity: 0, duration: 0.6, ease: "power1.in" },
        1.6
      )
      tl.to($.get("ring"), { opacity: 0.8, duration: 0.3 }, 0.3)
      await tl
      $.keep(
        gsap.fromTo(
          $.get("ring"),
          { scale: 1, opacity: 0.8, svgOrigin: ORIGIN },
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
      tl.to($.get("trailLayer"), { opacity: 0, duration: 0.35 }, 0)
      await tl
    },

    async burnout() {
      // The same as take A: grey out to the muted state, then fade away.
      const gsap = await loadGsap()
      gsap.killTweensOf($.get("ring"))
      const tl = $.keep(gsap.timeline())
      const lit = [$.get("litDisc"), $.get("litIcon"), $.get("ring")]
      const ended = [$.get("endedDisc"), $.get("unlitIcon")]

      if (reduced) {
        tl.to([...lit, $.get("sky")], { opacity: 0, duration: 0.3 }, 0)
        tl.to(ended, { opacity: 1, duration: 0.3 }, 0)
        tl.to(ended, { opacity: 0, duration: 0.4 }, 1)
        await tl
        return
      }

      tl.to([...lit, $.get("sky")], { opacity: 0, duration: 0.8 }, 0)
      tl.to(ended, { opacity: 1, duration: 0.8 }, 0)
      tl.to(
        ended,
        {
          opacity: 0,
          scale: 0.9,
          svgOrigin: ORIGIN,
          duration: 0.9,
          ease: "power1.in",
        },
        1.2
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
          <radialGradient id={`${id}-sky`}>
            <stop offset="0" style={{ stopColor: LIT_FILL[tone] }} />
            <stop
              offset="1"
              style={{ stopColor: LIT_FILL[tone], stopOpacity: 0 }}
            />
          </radialGradient>
        </defs>
        <circle
          ref={$.ref("sky")}
          cx={CX}
          cy={CY}
          r={190}
          fill={`url(#${id}-sky)`}
          opacity={0}
        />

        {/* Abstract dots on a ring, not anyone's position: faint until the
            light reaches them, then gone. */}
        <g ref={$.ref("dots")}>
          {FRIENDS.map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={3.5}
                style={{ fill: "var(--muted-foreground)" }}
                opacity={0.3}
              />
              <circle
                ref={$.ref(`ping${i}`)}
                cx={x}
                cy={y}
                r={3.5}
                fill="none"
                strokeWidth={1.5}
                style={{ stroke: "var(--primary)" }}
                opacity={0}
              />
              <circle
                ref={$.ref(`lit${i}`)}
                cx={x}
                cy={y}
                r={3.5}
                style={{ fill: "var(--primary)" }}
                opacity={0}
              />
            </g>
          ))}
        </g>

        <path ref={$.ref("trail")} d={TRAIL} fill="none" stroke="none" />
        <g ref={$.ref("trailLayer")} opacity={0}>
          <path
            ref={$.ref("trailGlow")}
            d={TRAIL}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            style={{ stroke: "var(--primary)" }}
            opacity={0.25}
          />
          <path
            ref={$.ref("trailLine")}
            d={TRAIL}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ stroke: "var(--primary)" }}
          />
        </g>

        {Array.from({ length: MAX_STRANDS }, (_, i) => (
          <path
            key={i}
            ref={$.ref(`strand${i}`)}
            d={strand(
              i,
              bloom.count,
              bloom.len[0] + (bloom.len[1] - bloom.len[0]) * jitter(i, 7)
            )}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0}
          />
        ))}
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
          ref={$.ref("dashed")}
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="4 5"
          style={{ stroke: "var(--muted-foreground)" }}
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
        {Array.from({ length: MAX_STRANDS }, (_, i) => (
          <circle
            cx={0}
            cy={0}
            key={i}
            ref={$.ref(`p${i}`)}
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
