"use client"

// The composer's side of the lighting moment (#376, behind
// `flareLightMoment`): the nav button's morph into the strike strip, what the
// composer needs to know to pick the take, and the layer the moment plays in.
// The motion itself is in lib/motion (#375).

import dynamic from "next/dynamic"
import { useEffect, useRef, type RefObject } from "react"
import type { Icon } from "@/components/icons"
import { STRIP_KNOB } from "@/components/strike-strip"
import { fetchMyFlares, type EventVisibility } from "@/lib/api/events"
import {
  hasLitOnDevice,
  pickLightingTake,
  toneFor,
  type LightingTake,
  type Point,
} from "@/lib/motion/lighting"
import { preloadGsap } from "@/lib/motion/load-gsap"
import { runMorph, type Rect } from "@/lib/motion/morph"
import { prefersReducedMotion } from "@/lib/motion/reduced-motion"
import type { FlareMomentSpec } from "@/lib/motion/flare-moment"

// The sheet slides in and out in 500 ms on vaul's curve. Opening, the pill
// lands with it; closing, the circle is home a little before the sheet has
// gone, so the nav doesn't wait on it.
const MORPH_OPEN_MS = 500
const MORPH_CLOSE_MS = 420
/** Whatever happens, the nav gets its button back after this long. */
const MORPH_SAFETY_MS = 1500

const NAV_CIRCLE = "[data-nav-flare-circle]"

const loadMoment = () => import("@/lib/motion/flare-moment")
const FlareMoment = dynamic(() => loadMoment().then((m) => m.FlareMoment), {
  ssr: false,
})

function navCircle(): Element | null {
  return document.querySelector(NAV_CIRCLE)
}

/** The centre of the nav's flare button, or the bottom middle without one. */
export function flareButtonCenter(): Point {
  const r = navCircle()?.getBoundingClientRect()
  if (r && r.width > 0) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight - 40 }
}

/**
 * Where the strike strip rests once the composer's sheet has landed: its
 * footer sits on the bottom of the visual viewport (useSheetVisibleHeight
 * sizes the card to what is on screen), so the strip's offset inside the
 * footer gives its place even while the sheet is still sliding in.
 */
function stripRest(strip: HTMLElement): Rect | null {
  const footer = strip.parentElement
  if (!footer) return null
  const s = strip.getBoundingClientRect()
  const f = footer.getBoundingClientRect()
  if (s.width === 0 || f.height === 0) return null
  const vv = window.visualViewport
  const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  return {
    left: s.left,
    top: bottom - (f.bottom - s.top),
    width: s.width,
    height: s.height,
  }
}

/** Calls `then` once `ok` holds (checked every frame), or after `maxFrames`. */
function whenPainted(ok: () => boolean, then: () => void, maxFrames = 6) {
  let n = 0
  const check = () => {
    if (ok() || ++n >= maxFrames) then()
    else requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}

/**
 * Morphs the nav's flare button into the strike strip when the composer
 * opens, and back when it closes (lib/motion/morph.ts). The morph hides the
 * strip while its clone stands in; the nav's circle stays hidden from the
 * open until the close morph lands on it. Reduced motion: no morph, the strip
 * is simply there and the nav keeps its button.
 */
export function useStrikeMorph({
  open,
  enabled,
  stripRef,
  onFlareButtonHidden,
}: {
  open: boolean
  enabled: boolean
  stripRef: RefObject<HTMLElement | null>
  onFlareButtonHidden?: (hidden: boolean) => void
}): void {
  const wasOpen = useRef(false)
  const hide = useRef(onFlareButtonHidden)
  useEffect(() => {
    hide.current = onFlareButtonHidden
  })

  useEffect(() => {
    if (!enabled) return
    const opening = open && !wasOpen.current
    const closing = !open && wasOpen.current
    wasOpen.current = open
    if (!opening && !closing) return
    if (prefersReducedMotion() || !navCircle()) return

    let finish: () => void = () => {}
    let cancelled = false
    const reveal = () => hide.current?.(false)
    // Closing: whatever happens to the morph, the nav gets its button back.
    const safety = closing ? setTimeout(reveal, MORPH_SAFETY_MS) : undefined

    // Let the sheet mount (opening) before measuring the strip.
    const frame = requestAnimationFrame(() => {
      const strip = stripRef.current
      if (cancelled) return
      if (!strip?.isConnected) {
        if (closing) reveal()
        return
      }
      const morph = runMorph({
        strip,
        button: navCircle,
        rest: () => (strip.isConnected ? stripRest(strip) : null),
        direction: opening ? "open" : "close",
        knob: STRIP_KNOB,
        durationMs: opening ? MORPH_OPEN_MS : MORPH_CLOSE_MS,
      })
      finish = morph.finish
      // The clone now covers the nav's circle, so hiding it can't flash.
      if (opening) hide.current?.(true)
      void morph.done.then(() => {
        if (cancelled) return
        if (opening) {
          morph.finish()
          return
        }
        clearTimeout(safety)
        reveal()
        // The clone goes once the nav has drawn its circle again.
        const circle = navCircle()
        whenPainted(
          () => !!circle && !circle.hasAttribute("data-hidden"),
          morph.finish
        )
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      finish()
      if (closing) {
        clearTimeout(safety)
        reveal()
      }
    }
  }, [open, enabled, stripRef])

  // Never leave the nav without its button.
  useEffect(() => () => hide.current?.(false), [])
}

/**
 * Whether the person has hosted a flare, fetched when the composer opens (so
 * it is known before the api creates the new one). Also preloads the
 * moment's code and GSAP then, so the first strike doesn't wait for them.
 */
export function useHostedSnapshot(open: boolean, enabled: boolean) {
  const snapshot = useRef<{ loaded: boolean; count: number }>({
    loaded: false,
    count: 0,
  })
  useEffect(() => {
    if (!enabled || !open) return
    void loadMoment().catch(() => {})
    preloadGsap()
    const ac = new AbortController()
    fetchMyFlares(ac.signal)
      .then((r) => {
        snapshot.current = {
          loaded: true,
          count: r.hostedByMe.length + r.pastHosted.length,
        }
      })
      .catch(() => {
        // Unknown: the wick plays (pickLightingTake).
      })
    return () => ac.abort()
  }, [open, enabled])
  return snapshot
}

export type LightingMoment = { id: number; spec: FlareMomentSpec }

/** What the moment for a just-confirmed flare looks like. */
export function lightingMomentFor(input: {
  hosted: { loaded: boolean; count: number }
  Icon: Icon
  visibility: EventVisibility
  startAt: string
  now?: number
}): FlareMomentSpec {
  const take: LightingTake = pickLightingTake({
    hostedLoaded: input.hosted.loaded,
    hostedCount: input.hosted.count,
    litOnDevice: hasLitOnDevice(),
  })
  return {
    take,
    Icon: input.Icon,
    tone: toneFor(input.visibility),
    live: new Date(input.startAt).getTime() <= (input.now ?? Date.now()),
    origin: flareButtonCenter(),
  }
}

/** The layer a lighting moment plays in, above everything but the toasts. */
export function LightingMomentLayer({
  moment,
  onLit,
  onDone,
}: {
  moment: LightingMoment | null
  onLit: () => void
  onDone: () => void
}) {
  if (!moment) return null
  return (
    <FlareMoment
      key={moment.id}
      spec={moment.spec}
      reduced={prefersReducedMotion()}
      onLit={onLit}
      onDone={onDone}
    />
  )
}
