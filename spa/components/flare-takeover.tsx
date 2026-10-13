"use client"

// The lighting takeover's layer (#376, behind `flareLightMoment`): mounted by
// the composer at the strike, it covers the whole screen, nav included, and
// drives the frame from lib/motion/takeover.ts every animation frame. It is
// a plain import (no lazy chunk, no animation library), so the strike never
// waits on a download.
//
// The map: the home map's own layer, [data-lighting-map], is zoomed and
// tilted with a CSS transform for the length of the moment, and put back
// after. That works the same on the Google map (tiles, vector canvas and
// markers alike, as one composited layer) and on the static fallback, needs
// nothing from Google's camera (tilt only exists on vector maps), and costs
// no snapshot. The map is a little soft while zoomed in, under the veil.
//
// One pin: the map draws the new flare's pin "held" (hidden) while this
// layer's pin stands in for it. At the end, with the map at rest, this pin
// sits exactly on the held one (measured on screen), and in one frame this
// pin goes and the map's shows; then the pin is released for good.

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { FlarePin, type FlarePinEvent } from "@/components/map-flare-pin"
import { MapPinIcon } from "@/components/icons"
import { haptic } from "@/lib/haptics"
import { releaseLitPin } from "@/lib/lit-flare"
import type { BurstLevel, Point } from "@/lib/motion/lighting"
import {
  cameraTransform,
  project,
  renderTakeover,
  restCamera,
  takeoverClock,
  TAKEOVER,
  type Camera,
  type TakeoverKit,
} from "@/lib/motion/takeover"
import { readPalette } from "@/lib/motion/takeover-canvas"
import { lerpPt } from "@/lib/motion/tween"
import { EVENT_TYPES } from "@/types/utils"

/** What the takeover shows: the flare as its pin, its title and when. */
export type TakeoverSpec = {
  pin: FlarePinEvent
  title: string
  /** "live now", "in 15 min", … (whenLabel). */
  when: string
  burst: BurstLevel
}

/** What the api said. `eventId` is null when its answer had no flare. */
export type TakeoverResult =
  | { ok: true; eventId: string | null }
  | { ok: false }

/**
 * "landed": the flare is on the map (or the moment finished without a map).
 * "dismissed": the api failed. "gave-up": the api took too long.
 */
export type TakeoverOutcome = "landed" | "dismissed" | "gave-up"

export const HERO_PIN_ID = "lighting-takeover"

/** How long the end waits for the map's pin to turn up, then lets go. */
const PIN_WAIT_MS = 900
const FADE_OUT_MS = 220
/** How often the map's pin is measured again while the map pans. */
const MEASURE_EVERY_MS = 250

/** The map's pin for `id`, its circle's centre at rest and its scale. */
function measurePin(
  id: string,
  map: HTMLElement | null
): { el: HTMLElement; at: Point; scale: number } | null {
  const el = document.querySelector<HTMLElement>(
    `[data-flare-pin="${CSS.escape(id)}"]`
  )
  const circle = el?.querySelector("[data-pin-circle]")
  if (!el || !circle) return null
  // Read it with the map's transform off, in one go (no paint in between).
  const prev = map?.style.transform ?? ""
  if (map) map.style.transform = "none"
  const r = circle.getBoundingClientRect()
  if (map) map.style.transform = prev
  if (r.width === 0) return null
  return {
    el,
    at: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
    scale: r.width / 40,
  }
}

export function FlareTakeover({
  spec,
  result,
  reduced,
  onEnd,
}: {
  spec: TakeoverSpec
  result: TakeoverResult | null
  reduced: boolean
  onEnd: (outcome: TakeoverOutcome) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const nightRef = useRef<HTMLDivElement>(null)
  const tintRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const heroScaleRef = useRef<HTMLDivElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef(result)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    resultRef.current = result
    onEndRef.current = onEnd
  })
  // The pins' clock, read once: the moment lasts seconds.
  const [now] = useState(() => Date.now())
  const Icon =
    EVENT_TYPES.find((t) => t.value === spec.pin.type)?.icon ?? MapPinIcon

  useLayoutEffect(() => {
    const e = {
      scrim: scrimRef.current,
      night: nightRef.current,
      tint: tintRef.current,
      canvas: canvasRef.current,
      hero: heroRef.current,
      heroScale: heroScaleRef.current,
      cover: coverRef.current,
      text: textRef.current,
    }
    const root = rootRef.current
    const canvas = e.canvas
    const ctx = canvas?.getContext("2d")
    if (!root || !canvas || !ctx) return

    const W = root.clientWidth
    const H = root.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const dark = document.documentElement.classList.contains("dark")

    // The map, if the home map is on screen, and where the flare will sit on
    // it: the middle of what the dock leaves free, where the map pans to.
    const map = document.querySelector<HTMLElement>("[data-lighting-map]")
    const mapRect = map?.getBoundingClientRect()
    const dockTop = document
      .querySelector("[data-map-dock]")
      ?.getBoundingClientRect().top
    const anchor: Point = mapRect
      ? {
          x: mapRect.left + mapRect.width / 2,
          y:
            (mapRect.top +
              (dockTop && dockTop > mapRect.top ? dockTop : mapRect.bottom)) /
            2,
        }
      : { x: W / 2, y: H * 0.45 }
    const origin: Point = mapRect
      ? { x: mapRect.left, y: mapRect.top }
      : { x: 0, y: 0 }
    if (map && !reduced) {
      map.style.transformOrigin = "0 0"
      map.style.willChange = "transform"
    }
    const resetMap = () => {
      if (!map) return
      map.style.transform = ""
      map.style.transformOrigin = ""
      map.style.willChange = ""
    }

    // Where the flare's pin is at rest: where the map should put it until
    // the map's own pin can be measured, then that, eased in.
    let measured: { at: Point; scale: number } | null = null
    let target = anchor
    let heroScale = 1
    let cam: Camera = restCamera(anchor)
    const textWidth = e.text?.offsetWidth ?? 0
    const heroChip = () =>
      e.hero?.querySelector<HTMLElement>("[data-pin-chip]") ?? null
    const heroRing = () =>
      e.hero?.querySelector<HTMLElement>(".animate-pulse-ring") ?? null

    const pinAt = (c: Camera) => project(c, anchor, target)
    const kit: TakeoverKit = {
      W,
      H,
      rest: restCamera(anchor),
      palette: readPalette(root, dark),
      burst: spec.burst,
      dark,
      ctx,
      camera(c) {
        cam = c
        const atRest =
          c.scale === 1 &&
          !c.tilt &&
          c.focus.x === anchor.x &&
          c.focus.y === anchor.y
        // At rest the map has no transform at all (one would make it a
        // containing block for anything fixed inside it).
        if (map && !reduced) {
          map.style.transform = atRest ? "" : cameraTransform(c, anchor, origin)
        }
        if (e.scrim) {
          const p = pinAt(c)
          e.scrim.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
        }
      },
      pinAt,
      scrim(a, spot) {
        const alpha = Math.max(0, a)
        if (e.scrim) e.scrim.style.opacity = String(alpha * spot)
        if (e.night) e.night.style.opacity = String(alpha * (1 - spot))
      },
      tint(a) {
        if (e.tint) e.tint.style.opacity = String(a)
      },
      hero(o) {
        const p = pinAt(cam)
        if (e.hero) {
          e.hero.style.opacity = String(o.show)
          e.hero.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
        }
        if (e.heroScale) {
          e.heroScale.style.transform = `scale(${o.scale * heroScale})`
        }
        if (e.cover) e.cover.style.opacity = String(1 - o.lit)
        const ring = heroRing()
        if (ring) ring.style.visibility = o.lit > 0.5 ? "" : "hidden"
        const chip = heroChip()
        if (chip) chip.style.opacity = String(o.chip)
      },
      text(show, dy) {
        const el = e.text
        if (!el) return
        const p = pinAt(cam)
        el.style.opacity = String(show)
        // Centred under the flare, kept on screen with a 16px gutter.
        const half = textWidth / 2
        const x = Math.min(Math.max(p.x, 16 + half), W - 16 - half)
        el.style.transform = `translate3d(${x - half}px, ${p.y + 30 + dy}px, 0)`
      },
      canvasAlpha(a) {
        if (e.canvas) e.canvas.style.opacity = String(a)
      },
      fade(a) {
        root.style.opacity = String(a)
      },
    }

    const duration = TAKEOVER.duration(reduced)
    const gateAt = TAKEOVER.gate(reduced)
    const ignition = TAKEOVER.ignition(reduced)
    let answeredAt: number | null = null
    let failedAt: number | null = null
    let outcome: TakeoverOutcome | null = null
    let eventId: string | null = null
    let lastMeasure = -Infinity
    let endAt: number | null = null
    let fired = false
    let handedOver = false
    let raf = 0
    // The moment's clock starts on its first animation frame, in the frames'
    // own time base.
    let t0: number | null = null

    const finish = (o: TakeoverOutcome) => {
      resetMap()
      onEndRef.current(o)
    }

    const step = (nowMs: number) => {
      t0 ??= nowMs
      const real = nowMs - t0
      const r = resultRef.current
      if (r && answeredAt === null && failedAt === null) {
        if (r.ok) {
          answeredAt = real
          eventId = r.eventId
        } else {
          failedAt = real
          outcome = "dismissed"
        }
      }
      if (!r && failedAt === null && real - gateAt > TAKEOVER.giveUpMs) {
        failedAt = real
        outcome = "gave-up"
      }
      if (failedAt !== null) root.style.pointerEvents = "none"

      // Track the map's own pin once it exists (it can move while the map
      // pans to it), and ease this pin onto it.
      if (eventId && real - lastMeasure > MEASURE_EVERY_MS) {
        lastMeasure = real
        const m = measurePin(eventId, map)
        if (m) measured = { at: m.at, scale: m.scale }
      }
      if (measured) {
        target = reduced ? measured.at : lerpPt(target, measured.at, 0.2)
        heroScale = reduced
          ? measured.scale
          : heroScale + (measured.scale - heroScale) * 0.2
      }

      const { t, gate } = takeoverClock({
        real,
        reduced,
        answeredAt,
        failedAt,
      })
      renderTakeover(Math.min(t, duration), kit, reduced, gate)
      if (!fired && failedAt === null && t >= ignition) {
        fired = true
        haptic("success")
      }

      if (gate.dismiss >= 1) {
        finish(outcome ?? "dismissed")
        return
      }
      if (t >= duration && failedAt === null) {
        endAt ??= real
        const m = eventId ? measurePin(eventId, map) : null
        if (m && !handedOver) {
          // The hand-over, all in this frame: this pin lands exactly on the
          // map's, then goes as the map's shows. The pulse keeps its phase.
          target = m.at
          heroScale = m.scale
          resetMap()
          renderTakeover(duration, kit, reduced, gate)
          const from = heroRing()?.getAnimations()[0]
          const to = m.el
            .querySelector(".animate-pulse-ring")
            ?.getAnimations()[0]
          if (from && to && from.startTime !== null) {
            to.startTime = from.startTime
          }
          if (e.hero) e.hero.style.visibility = "hidden"
          m.el.style.visibility = "visible"
          handedOver = true
          if (eventId) releaseLitPin(eventId)
          finish("landed")
          return
        }
        // No map pin to land on (no map on screen, or it never showed): this
        // pin fades away where it is.
        const since = real - endAt
        const waitFor = map && eventId ? PIN_WAIT_MS : 0
        if (since > waitFor) {
          const k = (since - waitFor) / FADE_OUT_MS
          if (e.hero) e.hero.style.opacity = String(Math.max(0, 1 - k))
          if (k >= 1) {
            finish("landed")
            return
          }
        }
      }
      raf = requestAnimationFrame(step)
    }
    // The first frame now, so the layer never shows unset for a frame.
    renderTakeover(
      0,
      kit,
      reduced,
      takeoverClock({ real: 0, reduced, answeredAt: null, failedAt: null }).gate
    )
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      resetMap()
      // Never leave the new pin hidden behind a moment that went away.
      if (eventId && !handedOver) releaseLitPin(eventId)
    }
    // One moment per mount: the composer keys it, and reads the api's answer
    // through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={rootRef}
      data-flare-moment="takeover"
      data-reduced={reduced ? "true" : "false"}
      data-burst={spec.burst}
      // Takes the screen, nav included, and every tap while it plays.
      className="fixed inset-0 z-[65] overflow-hidden"
    >
      <div
        ref={scrimRef}
        aria-hidden
        className="absolute top-0 left-0 rounded-full opacity-0"
        style={{
          width: 2400,
          height: 2400,
          marginLeft: -1200,
          marginTop: -1200,
          // A spotlight on the flare's spot: the map shows through around it.
          // The veil is the page's own background: night in dark mode, the
          // pale pink-cream (lighter, veilMax) in light mode.
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--background) 30%, transparent) 0px, color-mix(in oklch, var(--background) 45%, transparent) 70px, color-mix(in oklch, var(--background) 85%, transparent) 140px, var(--background) 250px)",
        }}
      />
      <div
        ref={nightRef}
        aria-hidden
        className="absolute inset-0 bg-background opacity-0"
      />
      <div
        ref={tintRef}
        aria-hidden
        className="absolute inset-0 opacity-0"
        style={{
          background:
            "radial-gradient(120% 70% at 50% 22%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 70%)",
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      <div
        ref={heroRef}
        aria-hidden
        className="absolute top-0 left-0 opacity-0"
      >
        <div className="-translate-x-1/2 -translate-y-5">
          <div ref={heroScaleRef} className="relative origin-[50%_20px]">
            <FlarePin event={spec.pin} own joined={false} now={now} />
            {/* The flare before it catches: the same circle, unlit. */}
            {!reduced && (
              <div
                ref={coverRef}
                className="absolute -top-0.5 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border-4 border-card bg-card text-muted-foreground shadow-lg"
              >
                <Icon aria-hidden className="size-5" />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* What was lit and when, in the app's own type. */}
      <div
        ref={textRef}
        role="status"
        className="absolute top-0 left-0 flex w-max max-w-72 flex-col items-center text-center opacity-0"
      >
        <p className="text-lg font-semibold text-foreground">{spec.title}</p>
        <p className="text-sm font-medium text-accent-ink">{spec.when}</p>
      </div>
    </div>
  )
}
