"use client"

// PROTOTYPE (#373, part of #370), round 3 — throwaway route, NOT production.
// Round 3 reworks only the intro slides (what / why / how, code-drawn art);
// everything after them is round 2, decided.
// Question: how does a first-time visitor learn what sponti is, look around
// before signing up, and get going after? One clickable flow on mock data
// only (no api, no auth, no geolocation):
//
//   slides → map + coach marks → location ask in the map sheet → browse →
//   sign-up ask when lighting a flare → back in the composer → checklist
//
// The bar switches the open calls: ?marks=A|B (which three coach marks),
// ?gate=sheet|page and ?at=tap|light (how and when sign-up is asked), ?friends=0|3 (after sign-up). ?s is the
// step (← / → keys), ?bar=0 hides the bar for screenshots. Once a direction
// is picked: record it in docs/decisions/, close the PR, delete this folder.

import { Suspense, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import { Flow, flowSteps } from "./_flow"
import {
  PrototypeBar,
  ProtoStyles,
  TOGGLES,
  type ParamPatch,
  type ProtoState,
} from "./_shared"

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
  options: readonly { key: T }[]
): T {
  return options.find((o) => o.key === value)?.key ?? options[0].key
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

  const base: ProtoState = {
    s: params.get("s") ?? "",
    marks: pick(params.get("marks"), TOGGLES.marks),
    gate: pick(params.get("gate"), TOGGLES.gate),
    at: pick(params.get("at"), TOGGLES.at),
    friends: pick(params.get("friends"), TOGGLES.friends),
    loc: params.get("loc") ?? "you",
    flare: params.get("flare") === "later" ? "later" : "lit",
    idea: params.get("idea") ?? "",
  }
  const steps = flowSteps(base)
  const state: ProtoState = {
    ...base,
    s: steps.some((st) => st.key === base.s) ? base.s : steps[0].key,
  }
  const showBar = params.get("bar") !== "0"

  const update = (next: ParamPatch) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) if (v !== undefined) sp.set(k, v)
    router.replace(`?${sp.toString()}`, { scroll: false })
    window.scrollTo(0, 0)
  }

  if (now === null) return null

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* The real bottom nav belongs to the signed-in app shell; these
          screens draw their own. */}
      <style>{`nav[aria-label="Primary"] { display: none !important; }`}</style>
      <ProtoStyles />
      {showBar && (
        <PrototypeBar state={state} steps={steps} onChange={update} />
      )}
      <Flow
        key={`${state.s}-${state.marks}`}
        state={state}
        now={now}
        go={(s, patch) => update({ ...patch, s })}
        stub={(what) => showActionFeedback(`prototype: ${what}`)}
      />
    </div>
  )
}
