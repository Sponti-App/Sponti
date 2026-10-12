"use client"

// The composer's side of the lighting moment (#376, behind
// `flareLightMoment`): the nav button's morph into the strike strip, what the
// composer needs to know to pick the take, and the layer the moment plays in.
// The motion itself is in lib/motion (#375).

import dynamic from "next/dynamic"
import { useEffect, useRef, useState, type RefObject } from "react"
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
import { runMorph } from "@/lib/motion/morph"
import { prefersReducedMotion } from "@/lib/motion/reduced-motion"
import type { FlareMomentSpec } from "@/lib/motion/flare-moment"

const MORPH_MS = 420
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
 * Morphs the nav's flare button into the strike strip when the composer
 * opens, and back when it closes (lib/motion/morph.ts). The strip stays
 * concealed while the clone stands in for it; the nav's circle stays hidden
 * from the open until the close morph lands on it. Reduced motion: no morph,
 * the strip is simply there and the nav keeps its button.
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
}): { concealed: boolean } {
  const [concealed, setConcealed] = useState(false)
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
    if (prefersReducedMotion() || !navCircle()) {
      // No morph: the strip is simply there, and the nav keeps its button.
      if (opening) queueMicrotask(() => setConcealed(false))
      return
    }

    let cancel: () => void = () => {}
    let cancelled = false
    const reveal = () => hide.current?.(false)
    const safety = setTimeout(reveal, MORPH_SAFETY_MS)
    hide.current?.(true)

    // Let the sheet mount (opening) before measuring the strip's slot.
    const frame = requestAnimationFrame(() => {
      const strip = stripRef.current
      if (cancelled) return
      if (!strip) {
        if (closing) reveal()
        return
      }
      // The clone stands in for the strip both ways: on the way out the
      // sheet still slides down with the strip in it.
      setConcealed(true)
      const morph = runMorph({
        strip,
        button: navCircle,
        slot: () => (strip.isConnected ? strip : null),
        direction: opening ? "open" : "close",
        knob: STRIP_KNOB,
        durationMs: MORPH_MS,
      })
      cancel = morph.cancel
      void morph.done.then(() => {
        if (opening) setConcealed(false)
        else {
          clearTimeout(safety)
          reveal()
        }
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      cancel()
      if (opening) queueMicrotask(() => setConcealed(false))
      else {
        clearTimeout(safety)
        reveal()
      }
    }
  }, [open, enabled, stripRef])

  // Never leave the nav without its button.
  useEffect(() => () => hide.current?.(false), [])

  return { concealed: enabled && concealed }
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
