"use client"

// PROTOTYPE (#374) — throwaway. The controller: takes one poll's worth of
// joins, decides whether it is the first join (overlay) or a later one
// (swing / puff), builds one master GSAP timeline and commits the guest list
// and unread count at each impact. Haptics go through the existing haptic()
// helper, which is native-only today (web vibration is #381 / PR #396).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { haptic } from "@/lib/haptics"
import { PEOPLE, type Motion, type Person, type Settings } from "./_mock"
import type { OverlayRefs } from "./_overlays"
import type { TargetRefs } from "./_screens"
import {
  buildFirst,
  buildPuff,
  buildSwing,
  loadGsap,
  type TargetEls,
  type Timeline,
} from "./_timelines"

// --- reduced motion -------------------------------------------------------

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)"
function subscribeReduce(cb: () => void) {
  const mq = window.matchMedia(REDUCE_QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
export function useReducedMotion(motion: Motion): boolean {
  const system = useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false
  )
  return motion === "reduce" || (motion === "system" && system)
}

// --- controller -----------------------------------------------------------

const nextFrame = () =>
  new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  )

declare global {
  interface Window {
    /** For the screenshot run: the master timeline of the latest moment. */
    __joinMoment?: { tl: Timeline | null }
  }
}

export type JoinMoment = ReturnType<typeof useJoinMoment>

export function useJoinMoment(
  settings: Settings,
  reduced: boolean,
  stage: React.RefObject<HTMLDivElement | null>,
  targets: React.RefObject<TargetRefs>,
  overlayRefs: React.RefObject<OverlayRefs>
) {
  const [guests, setGuests] = useState<Person[]>([])
  const [unread, setUnread] = useState(0)
  const [overlayPeople, setOverlayPeople] = useState<Person[]>([])
  const [puffPeople, setPuffPeople] = useState<Person[]>([])
  const [lastHaptic, setLastHaptic] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [announce, setAnnounce] = useState("")
  const guestsRef = useRef<Person[]>([])
  const master = useRef<Timeline | null>(null)
  const pollTimer = useRef<number | null>(null)
  const playing = useRef(false)

  const stopPoll = () => {
    if (pollTimer.current !== null) window.clearInterval(pollTimer.current)
    pollTimer.current = null
    setCountdown(null)
  }

  const reset = useCallback(() => {
    master.current?.kill()
    master.current = null
    playing.current = false
    stopPoll()
    guestsRef.current = []
    setGuests([])
    setUnread(0)
    setOverlayPeople([])
    setPuffPeople([])
    setAnnounce("")
  }, [])

  useEffect(
    () => () => {
      master.current?.kill()
    },
    []
  )

  // Idempotent, so scrubbing a paused timeline back over an impact (the
  // screenshot run does) never counts a join twice.
  const commit = (people: Person[]) => {
    const fresh = people.filter((p) => !guestsRef.current.includes(p))
    if (fresh.length === 0) return
    guestsRef.current = [...guestsRef.current, ...fresh]
    setGuests(guestsRef.current)
    setUnread((u) => u + fresh.length)
  }

  const buzz = (style: "success" | "light") => {
    void haptic(style)
    setLastHaptic(`${style} @ ${new Date().toLocaleTimeString("de-DE")}`)
  }

  /** The bell, unless the detail sheet covers it ("under"): then the slot. */
  const target = (): TargetEls | null => {
    const t = targets.current
    const toSlot = settings.where === "sheet" && settings.sheet === "under"
    if (toSlot) {
      return t.slot
        ? { hit: t.slot, ripple: t.slotRipple, badge: null, kind: "slot" }
        : null
    }
    return t.bell
      ? { hit: t.bell, ripple: t.bellRipple, badge: t.badge, kind: "bell" }
      : null
  }

  /** One poll's worth of joins arrives. */
  const deliver = async (people: Person[]) => {
    if (people.length === 0 || playing.current) return
    playing.current = true
    const first = guestsRef.current.length === 0
    const stacked = first && settings.batching === "stack"
    const headline = first ? (stacked ? people : people.slice(0, 1)) : []
    const later = first ? (stacked ? [] : people.slice(1)) : people
    setOverlayPeople(headline)
    setPuffPeople(settings.later === "puff" ? later : [])
    setAnnounce(`${people.map((p) => p.name).join(", ")} joined your flare`)
    await nextFrame()
    const gsap = await loadGsap()
    const stageEl = stage.current
    const hit = target()
    if (!stageEl || !hit) {
      playing.current = false
      return
    }
    const o = overlayRefs.current
    const tl = gsap.timeline({
      onComplete: () => {
        playing.current = false
        setOverlayPeople([])
        setPuffPeople([])
      },
    })
    if (headline.length > 0 && o.body && o.content) {
      tl.add(
        buildFirst(
          gsap,
          settings.overlay,
          settings.length,
          reduced,
          {
            body: o.body,
            content: o.content,
            ember: o.ember,
            ring: o.ring,
            anchor: o.anchor,
            sparks: o.sparks.filter((s): s is HTMLElement => !!s),
          },
          stageEl,
          hit,
          () => {
            commit(headline)
            buzz("success")
          }
        )
      )
    }
    later.forEach((p, i) => {
      const onImpact = () => {
        commit([p])
        buzz("light")
      }
      const puff = o.puffs[i]
      const piece =
        settings.later === "puff" && puff
          ? buildPuff(gsap, puff, stageEl, hit, reduced, onImpact)
          : buildSwing(gsap, hit, reduced, onImpact)
      // Queued joins follow the headline closely, then each other. (An
      // offset on an empty timeline would start before 0 and skip the
      // impact call, so the first piece of a later-only poll starts at 0.)
      const empty = i === 0 && headline.length === 0
      tl.add(piece, empty ? 0 : i === 0 ? ">-0.3" : ">-0.35")
    })
    master.current = tl
    window.__joinMoment = { tl }
  }

  /** Waits like the 30 s unread poll would (3–30 s), or not at all. */
  const arrive = (people: Person[]) => {
    if (settings.poll === "now") {
      void deliver(people)
      return
    }
    stopPoll()
    let left = 3 + Math.floor(Math.random() * 28)
    setCountdown(left)
    pollTimer.current = window.setInterval(() => {
      left -= 1
      setCountdown(left)
      if (left <= 0) {
        stopPoll()
        void deliver(people)
      }
    }, 1000)
  }

  /** Start over and play the first join (with the batch size). */
  const playFirst = () => {
    reset()
    const n = Number(settings.batch)
    // Wait a frame so the reset guest list has rendered.
    void nextFrame().then(() => arrive(PEOPLE.slice(0, n)))
  }

  /** The next friend joins (a later join once someone is going). */
  const joinNext = () => {
    const next = PEOPLE.find((p) => !guestsRef.current.includes(p))
    if (next) arrive([next])
  }

  return {
    guests,
    unread,
    overlayPeople,
    puffPeople,
    lastHaptic,
    countdown,
    announce,
    reduced,
    playFirst,
    joinNext,
    reset,
  }
}
