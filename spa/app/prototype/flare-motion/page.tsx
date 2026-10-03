"use client"

// PROTOTYPE (#371, part of #370) — throwaway route, NOT production.
// Question: what should lighting a flare feel like?
// A fuse runs along the flare's category icon outline and the flare bursts
// alight once the (mocked) api confirms it. Toggle the gesture (hold or
// strike), the burst intensity and colours, the burnout style and reduced
// motion from the bar, or with ?gesture=&burst=&colour=&who=&burnout=
// &motion=&api=&icon=. ?bar=0 hides the bar (for screenshots); the keys
// p / b / r still replay, burn out and reset.
// GSAP is loaded with a dynamic import() only when a moment plays.
// Once Patrick picks a direction: record it in docs/decisions/, close the
// draft PR and delete this folder.

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  APIS,
  BURNOUTS,
  BURSTS,
  CATEGORIES,
  COLOURS,
  DEFAULTS,
  GESTURES,
  MOCK_FLARE,
  MOTIONS,
  WHO,
  type Settings,
} from "./_mock"
import { PrototypeBar } from "./_shared"
import {
  FlareStage,
  useFlareMoment,
  useReducedMotion,
  type Phase,
} from "./_stage"
import { HoldVariant } from "./_variant-hold"
import { StrikeVariant } from "./_variant-strike"

export default function FlareMotionPrototypePage() {
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
    gesture: pick(params.get("gesture"), GESTURES, DEFAULTS.gesture),
    burst: pick(params.get("burst"), BURSTS, DEFAULTS.burst),
    colour: pick(params.get("colour"), COLOURS, DEFAULTS.colour),
    burnout: pick(params.get("burnout"), BURNOUTS, DEFAULTS.burnout),
    motion: pick(params.get("motion"), MOTIONS, DEFAULTS.motion),
    who: pick(params.get("who"), WHO, DEFAULTS.who),
    api: pick(params.get("api"), APIS, DEFAULTS.api),
    icon: pick(params.get("icon"), CATEGORIES, DEFAULTS.icon),
  }
  const showBar = params.get("bar") !== "0"

  const update = (next: Partial<Settings>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) sp.set(k, v)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }

  // Any knob change starts a fresh, unlit flare.
  return (
    <Moment
      key={JSON.stringify(settings)}
      settings={settings}
      showBar={showBar}
      onChange={update}
    />
  )
}

const STATUS: Record<Phase, string | null> = {
  idle: null,
  burning: "the fuse is burning",
  waiting: "lighting…",
  lit: "your flare is lit. your people can see it now",
  failed: null,
  ending: "burning out",
  ended: "this flare burned out",
}

function Moment({
  settings,
  showBar,
  onChange,
}: {
  settings: Settings
  showBar: boolean
  onChange: (next: Partial<Settings>) => void
}) {
  const reduced = useReducedMotion(settings.motion)
  const moment = useFlareMoment(settings, reduced)
  const category =
    CATEGORIES.find((c) => c.key === settings.icon) ?? CATEGORIES[0]
  const CategoryIcon = category.icon
  const visibility = settings.who === "invite" ? "invite only" : "open to all"
  const idle =
    settings.gesture === "hold"
      ? "hold to light your flare"
      : "strike to light your flare"
  const status = moment.note ?? STATUS[moment.phase] ?? idle
  const ended = moment.phase === "ended" || moment.phase === "ending"

  // p replays, b burns out, r resets (also with the bar hidden).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p") void moment.autoplay()
      if (e.key === "b") void moment.burnOut()
      if (e.key === "r") moment.reset()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="min-h-dvh bg-background pb-28">
      {showBar && (
        <PrototypeBar settings={settings} moment={moment} onChange={onChange} />
      )}

      <main className="px-4 pt-6">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl bg-card p-4 shadow-(--shadow-card)",
            moment.phase === "lit" && "border-l-[3px] border-l-accent",
            ended && "bg-muted/30"
          )}
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <CategoryIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-base font-semibold",
                ended && "text-muted-foreground"
              )}
            >
              {MOCK_FLARE.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {MOCK_FLARE.place} · {MOCK_FLARE.when} · {visibility}
            </p>
          </div>
          {moment.phase === "lit" && (
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
              live
            </span>
          )}
          {moment.phase === "ended" && (
            <span className="ml-auto text-xs text-muted-foreground">ended</span>
          )}
        </div>

        <div className="mt-10">
          <FlareStage moment={moment} />
        </div>

        <p
          aria-live="polite"
          data-testid="flare-status"
          className={cn(
            "mt-8 min-h-5 text-center text-sm",
            moment.phase === "lit" ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {status}
        </p>

        <div className="mt-6">
          {settings.gesture === "hold" ? (
            <HoldVariant moment={moment} />
          ) : (
            <StrikeVariant moment={moment} />
          )}
        </div>
      </main>
    </div>
  )
}
