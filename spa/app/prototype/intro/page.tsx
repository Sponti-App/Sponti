"use client"

// PROTOTYPE (#373, part of #370) — throwaway route, NOT production.
// Question: how does a first-time visitor learn what Sponti is and how to use
// it? Four parts, on mock data only (no api, no auth, no geolocation):
//
//   ?section=welcome   the public /welcome page before sign-up (A cards,
//                      B one scrolling story, C "try it" demo)
//   ?section=location  the location ask, with "pick an area" when denied
//   ?section=intro     how the post-sign-up intro (#313) changes
//   ?section=coach     map coach marks, before or after the location ask
//
// ?v picks the variant, ?s the step (← / → keys), plus ?cards=3|4,
// ?friends=0|3 and ?spot=idea|pin where they apply. ?bar=0 hides the
// prototype bar (for screenshots). Once a direction is picked: record it in
// docs/decisions/, close the PR and delete this folder.

import { Suspense, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import {
  PrototypeBar,
  ProtoStyles,
  SECTIONS,
  VARIANTS,
  type ProtoState,
  type Section,
  type StepProps,
} from "./_shared"
import { WelcomeCards, welcomeCardsSteps } from "./_variant-welcome-cards"
import { WELCOME_STORY_STEPS, WelcomeStory } from "./_variant-welcome-story"
import { WELCOME_TRY_STEPS, WelcomeTry } from "./_variant-welcome-try"
import {
  LOCATION_A_STEPS,
  LOCATION_B_STEPS,
  LocationOnMap,
  LocationOwnScreen,
} from "./_variant-location"
import {
  IntroChecklist,
  IntroOneScreen,
  IntroToday,
  introASteps,
  introBSteps,
} from "./_variant-after-signup"
import { COACH_STEPS, CoachMarks } from "./_variant-coach"

type Entry = {
  Component: (p: StepProps) => React.ReactNode
  steps: (s: ProtoState) => number
}

const ENTRIES: Record<Section, Record<string, Entry>> = {
  welcome: {
    A: { Component: WelcomeCards, steps: (s) => welcomeCardsSteps(s.cards) },
    B: { Component: WelcomeStory, steps: () => WELCOME_STORY_STEPS },
    C: { Component: WelcomeTry, steps: () => WELCOME_TRY_STEPS },
  },
  location: {
    A: { Component: LocationOwnScreen, steps: () => LOCATION_A_STEPS },
    B: { Component: LocationOnMap, steps: () => LOCATION_B_STEPS },
  },
  intro: {
    now: { Component: IntroToday, steps: () => 1 },
    A: { Component: IntroOneScreen, steps: (s) => introASteps(s.friends) },
    B: { Component: IntroChecklist, steps: (s) => introBSteps(s.friends) },
  },
  coach: {
    after: { Component: CoachMarks, steps: () => COACH_STEPS },
    before: { Component: CoachMarks, steps: () => COACH_STEPS },
  },
}

export default function IntroPrototypePage() {
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

// A clock that ticks every 30s, and is null on the server so the
// time-relative mock data never causes a hydration mismatch.
const TICK = 30_000
function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, TICK)
  return () => window.clearInterval(id)
}
const clockSnapshot = () => Math.floor(Date.now() / TICK) * TICK
const serverClockSnapshot = () => null

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const { showActionFeedback } = useActionFeedback()
  const now = useSyncExternalStore(
    subscribeClock,
    clockSnapshot,
    serverClockSnapshot
  )

  const section = pick<Section>(
    params.get("section"),
    SECTIONS.map((s) => s.key),
    "welcome"
  )
  const variants = VARIANTS[section].map((v) => v.key)
  const base = {
    section,
    v: pick(params.get("v"), variants, variants[0]),
    s: 0,
    cards: pick(params.get("cards"), ["3", "4"] as const, "3"),
    friends: pick(params.get("friends"), ["0", "3"] as const, "0"),
    spot: pick(params.get("spot"), ["idea", "pin"] as const, "idea"),
  } satisfies ProtoState
  const entry = ENTRIES[section][base.v]
  const steps = entry.steps(base)
  const rawStep = Number.parseInt(params.get("s") ?? "0", 10)
  const state: ProtoState = {
    ...base,
    s: Number.isFinite(rawStep) ? Math.min(Math.max(rawStep, 0), steps - 1) : 0,
  }
  const showBar = params.get("bar") !== "0"

  const update = (next: Partial<Record<keyof ProtoState, string>>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) if (v !== undefined) sp.set(k, v)
    router.replace(`?${sp.toString()}`, { scroll: false })
    window.scrollTo(0, 0)
  }

  if (now === null) return null
  const Variant = entry.Component

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* The real bottom nav belongs to the signed-in app; these screens
          draw their own (or none, before sign-up). */}
      <style>{`nav[aria-label="Primary"] { display: none !important; }`}</style>
      <ProtoStyles />
      {showBar && (
        <PrototypeBar state={state} steps={steps} onChange={update} />
      )}
      <Variant
        key={`${state.section}-${state.v}-${state.cards}-${state.friends}`}
        state={state}
        now={now}
        go={(s) => update({ s: String(s) })}
        stub={(what) => showActionFeedback(`prototype: ${what}`)}
      />
    </div>
  )
}
