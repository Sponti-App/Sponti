"use client"

// PROTOTYPE (#371, round 2) — throwaway route, NOT production. Nothing
// links to it. Question: how does lighting a flare move (fuse, burst,
// burnout)? Round 1 (#405) kept the strike swipe and the burst but dropped
// the scaled-up icon and the double-edged stroke fuse. This round tries three
// different compositions, with the icon at its natural 24px inside each:
//
//   ?take=launch  C: a signal flare goes up (picked for the first flare)
//   ?take=wick    A: a rope burns up to the flare, a small flame catches
//                 (picked for every flare after the first)
//   ?take=flame   B: the flare is a flame; the fuse climbs its one outline
//
// Patrick's pick (2026-10-12, provisional until the real-phone check): C for
// someone's first flare, then A for every flare after. The bar labels them so.
//
// Other params: ?type= (category), ?tone=peach|invite|open, ?burst=soft|full,
// ?motion=system|reduced|full, ?api=fast|slow|fail, ?bar=0 hides the bar.
// Keys: r replays, b burns the lit flare out.
//
// Once Patrick picks a direction: record it in docs/decisions/, close the
// PR and build it for real in spa/lib/motion/ (#375).

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"
import type { EventType } from "@/lib/api/events"
import {
  loadGsap,
  type Intensity,
  type TakeHandle,
  type TakeKey,
  type Tone,
} from "./_shared"
import { StrikeStrip } from "./_strike"
import { FlameTake } from "./_take-flame"
import { LaunchTake } from "./_take-launch"
import { WickTake } from "./_take-wick"

const TAKES = { wick: WickTake, flame: FlameTake, launch: LaunchTake }
const API_DELAY = { fast: 350, slow: 2200, fail: 700 }
type Api = keyof typeof API_DELAY
type Motion = "system" | "reduced" | "full"
type Phase =
  | "idle"
  | "slow"
  | "burning"
  | "waiting"
  | "lit"
  | "ended"
  | "failed"

const STATUS: Record<Phase, string> = {
  idle: "",
  slow: "strike faster",
  burning: "",
  waiting: "",
  lit: "lit. your people can see it",
  ended: "burned out",
  failed: "didn't catch. try again",
}

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

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

function pick<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T
): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const take = pick<TakeKey>(
    params.get("take"),
    ["wick", "flame", "launch"],
    "launch"
  )
  const tone = pick<Tone>(
    params.get("tone"),
    ["peach", "invite", "open"],
    "peach"
  )
  const intensity = pick<Intensity>(
    params.get("burst"),
    ["soft", "full"],
    "full"
  )
  const motion = pick<Motion>(
    params.get("motion"),
    ["system", "reduced", "full"],
    "system"
  )
  const api = pick<Api>(params.get("api"), ["fast", "slow", "fail"], "fast")
  const type = pick<EventType>(
    params.get("type"),
    EVENT_TYPES.map((t) => t.value),
    "drinks"
  )
  const showBar = params.get("bar") !== "0"
  const Icon = EVENT_TYPES.find((t) => t.value === type)!.icon

  const systemReduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
  const reduced = motion === "reduced" || (motion === "system" && systemReduced)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const [phase, setPhase] = useState<Phase>("idle")
  const [mount, setMount] = useState(0)
  const takeRef = useRef<TakeHandle>(null)
  const run = useRef(0)

  const replay = useCallback(() => {
    run.current++
    setPhase("idle")
    setMount((m) => m + 1)
  }, [])

  // Any change of take, tone, burst, icon or motion starts over: the take
  // remounts (its key) and an in-flight moment is dropped.
  const config = `${take}|${tone}|${intensity}|${type}|${reduced}`
  const [seen, setSeen] = useState(config)
  if (seen !== config) {
    setSeen(config)
    setPhase("idle")
  }
  useEffect(() => {
    run.current++
  }, [config])

  const strike = async (ok: boolean) => {
    if (!ok) {
      void haptic("light")
      setPhase("slow")
      return
    }
    const me = ++run.current
    const live = () => run.current === me
    void haptic("medium")
    setPhase("burning")
    let settled = false
    const created = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(api !== "fail"), API_DELAY[api])
    ).finally(() => {
      settled = true
    })
    await takeRef.current?.ignite()
    if (!live()) return
    if (!settled) {
      setPhase("waiting")
      takeRef.current?.wait()
    }
    const confirmed = await created
    if (!live()) return
    if (confirmed) {
      void haptic("success")
      setPhase("lit")
      await takeRef.current?.burst()
    } else {
      void haptic("error")
      await takeRef.current?.fizzle()
      if (!live()) return
      setMount((m) => m + 1)
      setPhase("failed")
    }
  }

  const burnout = useCallback(async () => {
    if (phase !== "lit") return
    const me = ++run.current
    void haptic("light")
    await takeRef.current?.burnout()
    if (run.current === me) setPhase("ended")
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === "r") replay()
      if (e.key === "b") void burnout()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [replay, burnout])

  const Take = TAKES[take]
  const ready = phase === "idle" || phase === "slow" || phase === "failed"
  const stripLabel = ready
    ? "swipe to light"
    : phase === "lit"
      ? "lit"
      : phase === "ended"
        ? "ended"
        : "lighting…"

  return (
    // Fixed over the app's chrome, so the bottom nav doesn't cover the strip.
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground">
      {showBar && (
        <Bar
          take={take}
          tone={tone}
          intensity={intensity}
          motion={motion}
          api={api}
          type={type}
          phase={phase}
          onSet={set}
          onReplay={replay}
          onBurnout={() => void burnout()}
        />
      )}
      <main
        data-testid="flare-motion-stage"
        data-phase={phase}
        className="flex flex-1 flex-col items-center justify-end gap-3 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex w-full max-w-sm flex-1 flex-col justify-end">
          <Take
            key={`${config}-${mount}`}
            ref={takeRef}
            Icon={Icon}
            tone={tone}
            intensity={intensity}
            reduced={reduced}
          />
        </div>
        <p
          className="h-5 text-sm text-muted-foreground"
          aria-live="polite"
          data-testid="flare-motion-status"
        >
          {STATUS[phase]}
        </p>
        <div className="w-full max-w-sm">
          <StrikeStrip
            ready={ready}
            label={stripLabel}
            onStart={() => void loadGsap()}
            onStrike={(ok) => void strike(ok)}
          />
        </div>
      </main>
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
  label,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  label?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center justify-center rounded-full px-3 text-xs",
        on ? "bg-card font-medium text-primary" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-full bg-muted p-0.5">
      {children}
    </div>
  )
}

function Bar(props: {
  take: TakeKey
  tone: Tone
  intensity: Intensity
  motion: Motion
  api: Api
  type: EventType
  phase: Phase
  onSet: (key: string, value: string) => void
  onReplay: () => void
  onBurnout: () => void
}) {
  const { onSet } = props
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3">
      <Group>
        {(
          [
            ["launch", "first flare"],
            ["wick", "every flare after"],
            ["flame", "b · flame"],
          ] as const
        ).map(([k, label]) => (
          <Chip key={k} on={props.take === k} onClick={() => onSet("take", k)}>
            {label}
          </Chip>
        ))}
      </Group>
      <Group>
        {EVENT_TYPES.map(({ value, label, icon: I }) => (
          <Chip
            key={value}
            label={label}
            on={props.type === value}
            onClick={() => onSet("type", value)}
          >
            <I className="size-4" />
          </Chip>
        ))}
      </Group>
      <div className="flex flex-wrap gap-2">
        <Group>
          {(["soft", "full"] as const).map((k) => (
            <Chip
              key={k}
              on={props.intensity === k}
              onClick={() => onSet("burst", k)}
            >
              {k}
            </Chip>
          ))}
        </Group>
        <Group>
          {(["peach", "invite", "open"] as const).map((k) => (
            <Chip
              key={k}
              on={props.tone === k}
              onClick={() => onSet("tone", k)}
            >
              {k}
            </Chip>
          ))}
        </Group>
      </div>
      <div className="flex flex-wrap gap-2">
        <Group>
          {(["system", "reduced", "full"] as const).map((k) => (
            <Chip
              key={k}
              on={props.motion === k}
              onClick={() => onSet("motion", k)}
            >
              {k}
            </Chip>
          ))}
        </Group>
        <Group>
          {(["fast", "slow", "fail"] as const).map((k) => (
            <Chip key={k} on={props.api === k} onClick={() => onSet("api", k)}>
              {k === "fail" ? "fails" : k}
            </Chip>
          ))}
        </Group>
      </div>
      <div className="flex flex-wrap gap-2">
        <Group>
          {(["light", "dark"] as const).map((k) => (
            <Chip key={k} on={resolvedTheme === k} onClick={() => setTheme(k)}>
              {k}
            </Chip>
          ))}
        </Group>
        <Group>
          <Chip on={false} onClick={props.onReplay}>
            replay
          </Chip>
          <Chip
            on={false}
            onClick={props.onBurnout}
            label="burn out the lit flare"
          >
            burn out
          </Chip>
        </Group>
      </div>
    </div>
  )
}
