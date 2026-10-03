"use client"

// PROTOTYPE (#374, part of #370) — throwaway route, NOT production.
// Question: what does the host see when the first friend joins their flare?
// An overlay ("mia joined your flare") plays and flies into the bell tab of
// the bottom nav; later joins only swing the bell and set the badge.
// Toggle the overlay (A card / B arc / C banner), its length and copy, the
// later-join treatment, where the host is when the poll brings the join in
// (map, the flare's detail sheet, calendar, after the flare started), how
// several joins in one poll batch, and reduced motion, from the bar or with
// ?overlay=&length=&shows=&later=&where=&sheet=&batch=&batching=&badge=
// &motion=&poll=. ?bar=0 hides the bar (for screenshots); the keys
// p / j / r / h still play the first join, add the next join, reset and
// toggle the bar.
// The stage covers the app's real chrome (fixed, above the real nav), and
// renders a mock nav whose bell it can measure and swing.
// GSAP is loaded with a dynamic import() only when a moment plays.
// Once Patrick picks a pattern: record it in docs/decisions/, close the
// draft PR and delete this folder.

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { GearIcon } from "@/components/icons"
import {
  BADGES,
  BATCHES,
  BATCHINGS,
  DEFAULTS,
  LATERS,
  LENGTHS,
  MOTIONS,
  OVERLAYS,
  POLLS,
  SHEET_NAVS,
  SHOWS,
  WHERES,
  type Settings,
} from "./_mock"
import { useJoinMoment, useReducedMotion } from "./_moment"
import { OverlayLayer, type OverlayRefs } from "./_overlays"
import {
  CalendarScreen,
  DetailSheet,
  MapScreen,
  MockNav,
  type TargetRefs,
} from "./_screens"
import { PrototypeBar } from "./_shared"

export default function JoinMomentPrototypePage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        prototypes are only available in development.
      </p>
    )
  }
  return (
    <Suspense>
      <Prototype />
    </Suspense>
  )
}

function pick<T extends string>(
  value: string | null,
  options: readonly { key: T }[],
  fallback: T
): T {
  return options.some((o) => o.key === value) ? (value as T) : fallback
}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const settings: Settings = {
    overlay: pick(params.get("overlay"), OVERLAYS, DEFAULTS.overlay),
    length: pick(params.get("length"), LENGTHS, DEFAULTS.length),
    shows: pick(params.get("shows"), SHOWS, DEFAULTS.shows),
    later: pick(params.get("later"), LATERS, DEFAULTS.later),
    where: pick(params.get("where"), WHERES, DEFAULTS.where),
    sheet: pick(params.get("sheet"), SHEET_NAVS, DEFAULTS.sheet),
    batch: pick(params.get("batch"), BATCHES, DEFAULTS.batch),
    batching: pick(params.get("batching"), BATCHINGS, DEFAULTS.batching),
    badge: pick(params.get("badge"), BADGES, DEFAULTS.badge),
    motion: pick(params.get("motion"), MOTIONS, DEFAULTS.motion),
    poll: pick(params.get("poll"), POLLS, DEFAULTS.poll),
  }
  const showBar = params.get("bar") !== "0"

  const update = (next: Partial<Settings> & { bar?: string }) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) sp.set(k, v)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }

  // Any knob change starts over with no one going.
  return (
    <Moment
      key={JSON.stringify(settings)}
      settings={settings}
      showBar={showBar}
      onChange={update}
      onToggleBar={() => update({ bar: showBar ? "0" : "1" })}
    />
  )
}

function Moment({
  settings,
  showBar,
  onChange,
  onToggleBar,
}: {
  settings: Settings
  showBar: boolean
  onChange: (next: Partial<Settings>) => void
  onToggleBar: () => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const targets = useRef<TargetRefs>({
    bell: null,
    bellRipple: null,
    badge: null,
    slot: null,
    slotRipple: null,
  })
  const overlayRefs = useRef<OverlayRefs>({
    body: null,
    content: null,
    ember: null,
    ring: null,
    anchor: null,
    sparks: [],
    puffs: [],
  })
  // Ref callbacks that file each node where the timelines look for it.
  const reg = useCallback(
    (key: keyof TargetRefs) => (n: HTMLElement | null) => {
      targets.current[key] = n
    },
    []
  )
  const set = useCallback(
    (key: keyof OverlayRefs, index = 0) =>
      (n: HTMLElement | null) => {
        const refs = overlayRefs.current
        if (key === "sparks" || key === "puffs") refs[key][index] = n
        else refs[key] = n
      },
    []
  )
  const reduced = useReducedMotion(settings.motion)
  const moment = useJoinMoment(settings, reduced, stage, targets, overlayRefs)

  // The mock nav's height, so sheets can sit flush on it (the app does the
  // same with --sponti-nav-h).
  const [navH, setNavH] = useState(64)
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setNavH(el.offsetHeight))
    ro.observe(el, { box: "border-box" })
    return () => ro.disconnect()
  }, [])

  // p plays the first join, j the next join, r resets, h toggles the bar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p") moment.playFirst()
      if (e.key === "j") moment.joinNext()
      if (e.key === "r") moment.reset()
      if (e.key === "h") onToggleBar()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const started = settings.where === "started"

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-background">
      {showBar && (
        <PrototypeBar
          settings={settings}
          moment={moment}
          onChange={onChange}
          onHide={onToggleBar}
        />
      )}
      <div
        ref={stage}
        data-testid="stage"
        className="relative flex-1 overflow-hidden"
      >
        {settings.where === "calendar" ? (
          <CalendarScreen guests={moment.guests} />
        ) : (
          <MapScreen guests={moment.guests} started={started} navH={navH} />
        )}
        <MockNav
          unread={moment.unread}
          badge={settings.badge}
          reg={reg}
          navRef={navRef}
        />
        {settings.where === "sheet" && (
          <DetailSheet
            guests={moment.guests}
            sheetNav={settings.sheet}
            navH={navH}
            reg={reg}
          />
        )}
        <OverlayLayer
          overlay={settings.overlay}
          people={moment.overlayPeople}
          puffs={moment.puffPeople}
          shows={settings.shows}
          started={started}
          set={set}
        />
        <p aria-live="polite" className="sr-only">
          {moment.announce}
        </p>
        {!showBar && (
          <button
            type="button"
            aria-label="show prototype bar"
            onClick={onToggleBar}
            data-testid="show-bar"
            className="absolute top-14 right-2 z-50 flex size-8 items-center justify-center rounded-full bg-zinc-900/70 text-zinc-100 opacity-40"
          >
            <GearIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
