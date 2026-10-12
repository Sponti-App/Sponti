"use client"

// PROTOTYPE (#371, round 2) — throwaway. Take B, "flame": the flare is a
// flame drawn as one dashed outline, with the category icon at its natural
// size in its belly. The strike lights the base, two sparks climb the one
// outline and meet at the tip, and the flame fills from the bottom up and
// keeps flickering. Burnout mirrors it: the flame shrinks into its base, the
// sparks run back
// down from the tip, and a curl of smoke leaves the tip.

import { forwardRef, useImperativeHandle, useRef } from "react"
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
  tipOf,
  useStageEls,
  useSvgId,
  type Gsap,
  type TakeHandle,
  type TakeProps,
} from "./_shared"

const W = 320
const H = 400

const FLAME =
  "M160 336 C116 336 92 306 92 268 C92 226 122 204 134 166 C138 186 146 198 156 204 C152 168 166 128 196 100 C192 140 228 176 228 256 C228 304 200 336 160 336 Z"
const CORE =
  "M160 326 C136 326 122 308 122 286 C122 258 144 244 156 216 C164 240 198 254 198 286 C198 308 184 326 160 326 Z"
const SMOKE = "M196 96 C188 84 206 76 197 64 C188 52 204 46 196 34"
const BASE_ORIGIN = "160 336"
const ICON_Y = 292
const FILL_FROM = 340
const FILL_TO = 90

export const FlameTake = forwardRef<TakeHandle, TakeProps>(function FlameTake(
  { Icon, tone, intensity, reduced },
  handle
) {
  const $ = useStageEls()
  const id = useSvgId()
  const spec = BURST[intensity]
  const tip = useRef(0.5)

  /** Both fuses at t (0 = base, 1 = tip). */
  const traceTo = (gsap: Gsap, t: number) => {
    const outline = $.get<SVGPathElement>("outline")
    const k = tip.current
    const l = t * k
    const r = 1 - t * (1 - k)
    gsap.set($.get("traceL"), { drawSVG: `0% ${l * 100}%` })
    gsap.set($.get("traceR"), { drawSVG: `${r * 100}% 100%` })
    const pl = pointAt(outline, l)
    const pr = pointAt(outline, r)
    gsap.set($.get("sparkL"), { x: pl.x, y: pl.y })
    gsap.set($.get("sparkR"), { x: pr.x, y: pr.y })
    return [pl, pr]
  }

  useImperativeHandle(handle, () => ({
    async ignite() {
      const gsap = await loadGsap()
      tip.current = tipOf($.get<SVGPathElement>("outline"))
      const tl = $.keep(gsap.timeline())
      if (reduced) {
        traceTo(gsap, 1)
        gsap.set([$.get("sparkL"), $.get("sparkR")], { opacity: 0 })
        tl.to($.get("traces"), { opacity: 1, duration: 0.2 })
        await tl
        return
      }
      traceTo(gsap, 0)
      gsap.set([$.get("traces"), $.get("sparkL"), $.get("sparkR")], {
        opacity: 1,
      })
      const state = { t: 0 }
      let n = 0
      tl.to(state, {
        t: 1,
        duration: 1.05,
        ease: "power1.in",
        onUpdate: () => {
          const [pl, pr] = traceTo(gsap, state.t)
          const pool = $.all<SVGCircleElement>("crk")
          if (n % 3 === 0) crackle(gsap, pool, pl.x, pl.y, n)
          if (n % 3 === 1) crackle(gsap, pool, pr.x, pr.y, n)
          n++
        },
      })
      // The two sparks meet at the tip and become one.
      tl.set($.get("sparkR"), { opacity: 0 })
      await tl
    },

    wait() {
      if (reduced) return
      void loadGsap().then((gsap) => {
        $.keep(
          gsap.to($.get("sparkLGlow"), {
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
      gsap.killTweensOf($.get("sparkLGlow"))
      const tl = $.keep(gsap.timeline())
      const outlines = [$.get("traces"), $.get("dashed")]

      if (reduced) {
        gsap.set($.get("fillRect"), { attr: { y: FILL_TO } })
        tl.to($.get("fire"), { opacity: 1, duration: 0.2 }, 0)
        tl.to(outlines, { opacity: 0, duration: 0.2 }, 0)
        tl.to($.get("unlitIcon"), { opacity: 0, duration: 0.2 }, 0)
        tl.to($.get("litIcon"), { opacity: 1, duration: 0.2 }, 0)
        await tl
        return
      }

      const [tx, ty] = [
        pointAt($.get<SVGPathElement>("outline"), tip.current).x,
        pointAt($.get<SVGPathElement>("outline"), tip.current).y,
      ]
      tl.to(
        $.get("sparkL"),
        { scale: 2.8, opacity: 0, duration: 0.25, ease: "power2.out" },
        0
      )
      tl.set($.get("fire"), { opacity: 1 }, 0)
      tl.fromTo(
        $.get("fillRect"),
        { attr: { y: FILL_FROM } },
        { attr: { y: FILL_TO }, duration: 0.4, ease: "power2.out" },
        0
      )
      tl.fromTo(
        $.get("fire"),
        { scale: 0.94, svgOrigin: BASE_ORIGIN },
        {
          keyframes: [
            { scale: spec.pop, duration: 0.25, ease: "power2.out" },
            { scale: 1, duration: 0.55, ease: "elastic.out(1, 0.5)" },
          ],
        },
        0.05
      )
      tl.to(outlines, { opacity: 0, duration: 0.35 }, 0.1)
      tl.fromTo(
        $.get("glow"),
        { opacity: 0, scale: 0.5, svgOrigin: "160 230" },
        {
          keyframes: [
            { opacity: spec.glow, scale: 1, duration: 0.25 },
            { opacity: 0.14, duration: 0.9 },
          ],
        },
        0
      )
      tl.to($.get("unlitIcon"), { opacity: 0, duration: 0.15 }, 0.12)
      tl.fromTo(
        $.get("litIcon"),
        { opacity: 0, scale: 0.7 },
        { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.4)" },
        0.14
      )
      // Embers leave the tip, upwards.
      addSparks(gsap, tl, $.all("p"), {
        cx: tx,
        cy: ty,
        count: spec.count,
        reach: spec.reach,
        colours: sparkColours(tone),
        at: 0.02,
        gravity: -18,
        angles: [-Math.PI * 0.95, -Math.PI * 0.05],
        duration: 0.9,
      })
      await tl

      // Alive while lit: the flame flickers and a few embers keep rising.
      $.keep(
        gsap.to($.get("fireShape"), {
          scaleY: "random(0.95, 1.06)",
          skewX: "random(-3, 3)",
          svgOrigin: BASE_ORIGIN,
          duration: "random(0.14, 0.28)",
          ease: "sine.inOut",
          repeat: -1,
          repeatRefresh: true,
        })
      )
      $.keep(
        gsap.to($.get("core"), {
          scaleY: "random(0.9, 1.1)",
          scaleX: "random(0.95, 1.04)",
          svgOrigin: "160 326",
          duration: "random(0.1, 0.2)",
          ease: "sine.inOut",
          repeat: -1,
          repeatRefresh: true,
        })
      )
      $.all("ember").forEach((e, i) => {
        $.keep(
          gsap.fromTo(
            e,
            {
              attr: { cx: tx - 14 + i * 9, cy: ty + 10 },
              x: 0,
              y: 0,
              opacity: 0.9,
            },
            {
              x: (i % 2 ? 1 : -1) * 10,
              y: -64,
              opacity: 0,
              duration: 1.6,
              delay: i * 0.45,
              repeat: -1,
              ease: "power1.out",
            }
          )
        )
      })
    },

    async fizzle() {
      const gsap = await loadGsap()
      gsap.killTweensOf($.get("sparkLGlow"))
      const tl = $.keep(gsap.timeline())
      tl.to([$.get("sparkL"), $.get("sparkR")], {
        scale: 0,
        opacity: 0,
        duration: 0.35,
      })
      tl.to($.get("traces"), { opacity: 0, duration: 0.35 }, 0)
      await tl
    },

    async burnout() {
      const gsap = await loadGsap()
      gsap.killTweensOf([$.get("fireShape"), $.get("core"), ...$.all("ember")])
      gsap.set($.all("ember"), { opacity: 0 })
      const tl = $.keep(gsap.timeline())

      if (reduced) {
        tl.to($.get("fire"), { opacity: 0, duration: 0.3 }, 0)
        tl.to($.get("glow"), { opacity: 0, duration: 0.3 }, 0)
        tl.to($.get("dashed"), { opacity: 0.6, duration: 0.3 }, 0)
        tl.to($.get("litIcon"), { opacity: 0, duration: 0.3 }, 0)
        tl.to($.get("unlitIcon"), { opacity: 1, duration: 0.3 }, 0)
        await tl
        return
      }

      // The flame shrinks down into its base and goes out.
      tl.to(
        $.get("fire"),
        {
          keyframes: [
            { scaleY: 1.06, scaleX: 0.96, duration: 0.2, ease: "sine.out" },
            {
              scaleY: 0.08,
              scaleX: 0.35,
              opacity: 0,
              duration: 1.1,
              ease: "power2.in",
            },
          ],
          svgOrigin: BASE_ORIGIN,
        },
        0
      )
      tl.to($.get("glow"), { opacity: 0, duration: 1 }, 0)
      // Mirror of the fuse: two dim sparks run from the tip back to the base.
      tl.add(() => traceTo(gsap, 1), 0)
      tl.set(
        [$.get("traces"), $.get("sparkL"), $.get("sparkR")],
        { opacity: 0.7, scale: 0.6 },
        0
      )
      const state = { t: 1 }
      tl.to(
        state,
        {
          t: 0,
          duration: 1.3,
          ease: "power1.out",
          onUpdate: () => traceTo(gsap, state.t),
        },
        0.1
      )
      tl.to(
        [$.get("sparkL"), $.get("sparkR")],
        { opacity: 0, duration: 1.3, ease: "power1.in" },
        0.1
      )
      tl.to($.get("dashed"), { opacity: 0.6, duration: 1 }, 0.4)
      tl.fromTo(
        $.get("smoke"),
        { opacity: 0.8, drawSVG: "0% 0%", y: 0 },
        {
          keyframes: [
            { drawSVG: "0% 100%", duration: 0.7, ease: "power1.out" },
            { drawSVG: "100% 100%", opacity: 0, y: -10, duration: 0.8 },
          ],
        },
        0.15
      )
      tl.to($.get("litIcon"), { opacity: 0, duration: 0.8 }, 0.4)
      tl.to($.get("unlitIcon"), { opacity: 1, duration: 0.8 }, 0.4)
      await tl
    },
  }))

  const pinCore = tone === "peach" ? "var(--chart-1)" : LIT_FILL[tone]

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
          <clipPath id={`${id}-fill`}>
            <rect
              ref={$.ref("fillRect")}
              x={0}
              y={FILL_FROM}
              width={W}
              height={300}
            />
          </clipPath>
          <linearGradient id={`${id}-grad`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: LIT_FILL[tone] }} />
            <stop offset="0.55" style={{ stopColor: LIT_FILL[tone] }} />
            <stop offset="1" style={{ stopColor: "var(--primary)" }} />
          </linearGradient>
        </defs>
        <circle
          ref={$.ref("glow")}
          cx={160}
          cy={230}
          r={170}
          fill={`url(#${id}-glow)`}
          opacity={0}
        />
        <path ref={$.ref("outline")} d={FLAME} fill="none" stroke="none" />
        <path
          ref={$.ref("dashed")}
          d={FLAME}
          fill="none"
          strokeWidth={2}
          strokeDasharray="5 7"
          strokeLinecap="round"
          style={{ stroke: "var(--muted-foreground)" }}
        />
        <g ref={$.ref("fire")} opacity={0}>
          <g clipPath={`url(#${id}-fill)`}>
            <path
              ref={$.ref("fireShape")}
              d={FLAME}
              fill={`url(#${id}-grad)`}
            />
            <path ref={$.ref("core")} d={CORE} style={{ fill: pinCore }} />
          </g>
        </g>
        <g ref={$.ref("traces")} opacity={0}>
          {(["traceL", "traceR"] as const).map((k) => (
            <path
              key={k}
              ref={$.ref(k)}
              d={FLAME}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              style={{ stroke: "var(--primary)" }}
            />
          ))}
        </g>
        <path
          ref={$.ref("smoke")}
          d={SMOKE}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ stroke: "var(--muted-foreground)" }}
          opacity={0}
        />
        {Array.from({ length: 4 }, (_, i) => (
          <circle
            cx={0}
            cy={0}
            key={i}
            ref={$.ref(`ember${i}`)}
            r={1.8}
            opacity={0}
            style={{ fill: "var(--primary)" }}
          />
        ))}
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
            cx={0}
            cy={0}
            key={i}
            ref={$.ref(`p${i}`)}
            r={0}
            opacity={0}
          />
        ))}
        {(["sparkL", "sparkR"] as const).map((k) => (
          <g key={k} ref={$.ref(k)} opacity={0}>
            <circle
              cx={0}
              cy={0}
              ref={$.ref(`${k}Glow`)}
              r={11}
              style={{ fill: "var(--primary)" }}
              opacity={0.35}
            />
            <circle cx={0} cy={0} r={4} style={{ fill: "var(--primary)" }} />
            <circle cx={0} cy={0} r={1.8} style={{ fill: "var(--chart-1)" }} />
          </g>
        ))}
      </svg>
      <IconLayer
        Icon={Icon}
        x={160}
        y={ICON_Y}
        w={W}
        h={H}
        litColour={LIT_INK[tone]}
        litRef={$.ref("litIcon")}
        unlitRef={$.ref("unlitIcon")}
      />
    </div>
  )
})
