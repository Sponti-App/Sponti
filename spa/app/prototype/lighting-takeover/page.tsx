"use client"

// PROTOTYPE (lighting takeover) — throwaway route, NOT production. Nothing
// links to it. Question: can the "flare lit" moment be a full-screen success
// beat, like a dating app's "it's a match", instead of a burst next to the
// map pin? Patrick's real-phone test of #376 showed two pins for the length
// of the wick: the moment's flare and the real pin. Here the moment's pin IS
// the flare's pin from its first frame, and the map's pin only shows when the
// moment hands over to it, in the same frame, at the same spot.
//
// Round 2 (Patrick, 2026-10-13): take C, "night flare", for every flare (the
// first flare ever on the device gets the full burst, later ones the soft
// one). No "lit" text and no flame on the pin: the pin keeps its category
// icon, and the only text is the flare's title and when. It starts at the
// strike, holds until the api has created the flare, and a failure dismisses
// it. Light mode gets a lighter veil; dark mode keeps the night.
//
// Params: ?type= (category), ?join=invite|open, ?when=now|soon,
// ?flare=first|later, ?api=fast|slow|fail, ?motion=system|reduced|full,
// ?speed=1|0.25, ?bar=0 hides the controls. Keys: r replays.
// window.__takeover.seek(ms) draws any frame (the screenshot run uses it).
//
// It runs on mock data only: no backend, no session (app-chrome.tsx lets
// /prototype/* skip the auth gate). Once built for real in spa/lib/motion/,
// close the PR.

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useActionFeedback } from "@/components/action-feedback"
import { ArrowCounterClockwiseIcon, CaretDownIcon } from "@/components/icons"
import type { EventType } from "@/lib/api/events"
import { haptic } from "@/lib/haptics"
import { useReducedMotion } from "@/lib/motion/reduced-motion"
import { cn } from "@/lib/utils"
import { EVENT_TYPES } from "@/types/utils"
import {
  cameraTransform,
  project,
  readPalette,
  seg,
  type Camera,
  type Point,
} from "./_engine"
import {
  FLARE,
  OTHERS,
  Scene,
  emptyEls,
  litEvent,
  type SceneEls,
} from "./_scene"
import { NO_GATE, take, type Burst, type Gate, type Kit } from "./_takes"

const API_MS = { fast: 350, slow: 2600, fail: 1100 } as const
type Api = keyof typeof API_MS
const DISMISS_MS = 320

const TITLES: Record<EventType, string> = {
  hangout: "hang out at the park",
  drinks: "after-work drinks",
  food: "ramen run",
  party: "rooftop party",
  sports: "workout",
  culture: "museum night",
  hobby: "sketching by the canal",
}

type Motion = "system" | "reduced" | "full"
type Phase = "idle" | "playing" | "done"

declare global {
  interface Window {
    __takeover?: {
      seek(ms: number, gate?: Partial<Gate>): void
      duration(): number
      gate(): number
    }
  }
}

export default function LightingTakeoverPrototypePage() {
  if (!prototypesAllowed()) {
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

/** Local dev and Vercel's preview deploys, never production (main). */
function prototypesAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true
  const ref = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ?? ""
  return ref !== "" && ref !== "main"
}

function pick<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T
): T {
  return options.includes(value as T) ? (value as T) : fallback
}

// The page's clock, read once on the client (null on the server, so nothing
// time-relative is rendered before hydration).
let mountClock: number | null = null
const getClock = () => (mountClock ??= Math.floor(Date.now() / 60_000) * 60_000)
const noSubscribe = () => () => {}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const now = useSyncExternalStore(noSubscribe, getClock, () => null)
  const { showActionFeedback } = useActionFeedback()

  const type = pick<EventType>(
    params.get("type"),
    EVENT_TYPES.map((t) => t.value),
    "sports"
  )
  const join = pick(params.get("join"), ["invite", "open"] as const, "invite")
  const when = pick(params.get("when"), ["now", "soon"] as const, "now")
  const flare = pick(params.get("flare"), ["first", "later"] as const, "first")
  const api = pick<Api>(params.get("api"), ["fast", "slow", "fail"], "fast")
  const motion = pick<Motion>(
    params.get("motion"),
    ["system", "reduced", "full"],
    "system"
  )
  const speed = params.get("speed") === "0.25" ? 0.25 : 1
  const showBar = params.get("bar") !== "0"

  const systemReduced = useReducedMotion()
  const reduced = motion === "reduced" || (motion === "system" && systemReduced)
  const burst: Burst = flare === "first" ? "full" : "soft"
  const Icon = EVENT_TYPES.find((t) => t.value === type)!.icon
  const title = TITLES[type]

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const elsRef = useRef<SceneEls>(emptyEls())
  const stageRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [panel, setPanel] = useState(false)
  const raf = useRef(0)
  const kitRef = useRef<Kit | null>(null)
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  // ---- the kit: setters over the scene's elements ----------------------------

  const buildKit = useCallback((): Kit | null => {
    const els = elsRef.current
    const stage = stageRef.current
    const canvas = els.canvas
    if (!stage || !canvas) return null
    const W = stage.clientWidth
    const H = stage.clientHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (canvas.width !== Math.round(W * dpr)) {
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let focus: Point = { x: 0, y: 0 }
    // Read once here, never per frame.
    const textWidth = els.text?.offsetWidth ?? 0
    const heroChip = () =>
      els.hero?.querySelector<HTMLElement>("[data-pin-chip]") ?? null
    const heroRing = () =>
      els.hero?.querySelector<HTMLElement>(".animate-pulse-ring") ?? null
    return {
      W,
      H,
      start: { focus: { x: W * 0.72, y: H * 0.6 }, scale: 1, tilt: 0 },
      final: { focus: { x: W / 2, y: H * 0.36 }, scale: 1, tilt: 0 },
      palette: readPalette(stage, dark),
      burst,
      dark,
      ctx,
      camera(c: Camera) {
        focus = c.focus
        if (els.world) els.world.style.transform = cameraTransform(c, FLARE)
        OTHERS.forEach((o, i) => {
          const el = els.others[i]
          if (!el) return
          const q = project(c, FLARE, o.at)
          el.style.transform = `translate3d(${q.x}px, ${q.y}px, 0)`
        })
        const at = `translate3d(${focus.x}px, ${focus.y}px, 0)`
        if (els.mapPin) els.mapPin.style.transform = at
        if (els.hero) els.hero.style.transform = at
        if (els.scrim) els.scrim.style.transform = at
      },
      scrim(a, spot) {
        const alpha = Math.max(0, a)
        if (els.scrim) els.scrim.style.opacity = String(alpha * spot)
        if (els.night) els.night.style.opacity = String(alpha * (1 - spot))
      },
      tint(a) {
        if (els.tint) els.tint.style.opacity = String(a)
      },
      sheet(k, red) {
        const el = els.sheet
        if (!el) return
        el.style.transform = red ? "" : `translate3d(0, ${k * 105}%, 0)`
        el.style.opacity = red ? String(1 - k) : ""
        el.style.pointerEvents = k > 0 ? "none" : ""
      },
      hero(o) {
        if (els.hero) els.hero.style.opacity = String(o.show)
        if (els.heroScale) els.heroScale.style.transform = `scale(${o.scale})`
        if (els.cover) els.cover.style.opacity = String(1 - o.lit)
        const ring = heroRing()
        if (ring) ring.style.visibility = o.lit > 0.5 ? "" : "hidden"
        const chip = heroChip()
        if (chip) chip.style.opacity = String(o.chip)
      },
      text(show, dy) {
        const el = els.text
        if (!el) return
        el.style.opacity = String(show)
        // Centred under the flare, but kept on screen with a 16px gutter.
        const half = textWidth / 2
        const x = Math.min(Math.max(focus.x, 16 + half), W - 16 - half)
        el.style.transform = `translate3d(${x - half}px, ${focus.y + 30 + dy}px, 0)`
      },
      canvasAlpha(a) {
        if (els.canvas) els.canvas.style.opacity = String(a)
      },
      fade(a) {
        if (els.moment) els.moment.style.opacity = String(a)
      },
    }
  }, [burst, dark])

  /** Draws the frame at `t` ms. Past the end, the map's pin takes over. */
  const frame = useCallback(
    (t: number, gate: Gate = NO_GATE) => {
      const kit = kitRef.current
      if (!kit) return
      const dur = take.duration(reduced)
      kit.ctx.clearRect(0, 0, kit.W, kit.H)
      take.render(Math.min(t, dur), kit, reduced, gate)
      handover(elsRef.current, t >= dur)
    },
    [reduced]
  )

  const reset = useCallback(() => {
    cancelAnimationFrame(raf.current)
    kitRef.current = buildKit()
    frame(0)
  }, [buildKit, frame])

  // Any change of flare or motion starts over.
  const config = `${type}|${join}|${when}|${flare}|${api}|${reduced}|${speed}|${dark}|${now}`
  const [seen, setSeen] = useState(config)
  if (seen !== config) {
    setSeen(config)
    setPhase("idle")
  }
  useLayoutEffect(() => {
    if (now === null) return
    reset()
    const onResize = () => reset()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(raf.current)
    }
  }, [config, now, reset])

  /**
   * The strike: the takeover starts at once and the "api" answers after
   * API_MS. The timeline holds at the gate until it has; a failure fades the
   * takeover out and brings the composer back with the error.
   */
  const light = useCallback(() => {
    if (phase !== "idle") return
    cancelAnimationFrame(raf.current)
    kitRef.current = buildKit()
    setPanel(false)
    setPhase("playing")
    const dur = take.duration(reduced)
    const gateAt = take.gate(reduced)
    const ignition = take.ignition(reduced)
    const t0 = performance.now()
    let answered: number | null = null
    let failed: number | null = null
    window.setTimeout(() => {
      if (api === "fail") failed = performance.now()
      else answered = performance.now()
    }, API_MS[api])
    let fired = false
    let frozen = 0
    const step = (nowMs: number) => {
      const real = (nowMs - t0) * speed
      const wait = Math.max(0, real - gateAt)
      const waitEnd =
        answered === null
          ? Infinity
          : Math.max(0, (answered - t0) * speed - gateAt)
      let t = real <= gateAt ? real : gateAt + Math.max(0, wait - waitEnd)
      let dismiss = 0
      if (failed !== null) {
        const failT = (failed - t0) * speed
        frozen ||= Math.min(t, failT)
        t = frozen
        dismiss = seg(real, failT, failT + DISMISS_MS)
      }
      frame(t, { wait, waitEnd, dismiss })
      if (!fired && t >= ignition) {
        fired = true
        haptic("success")
      }
      if (dismiss >= 1) {
        haptic("error")
        showActionFeedback("couldn't light that flare", { tone: "error" })
        setPhase("idle")
        frame(0)
        return
      }
      if (t >= dur) {
        setPhase("done")
        return
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }, [phase, buildKit, frame, reduced, speed, api, showActionFeedback])

  const replay = useCallback(() => {
    setPhase("idle")
    reset()
  }, [reset])

  useEffect(() => {
    window.__takeover = {
      seek(ms: number, gate?: Partial<Gate>) {
        cancelAnimationFrame(raf.current)
        kitRef.current = buildKit()
        setPanel(false)
        frame(ms, { ...NO_GATE, ...gate })
      },
      duration: () => take.duration(reduced),
      gate: () => take.gate(reduced),
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r") replay()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      delete window.__takeover
    }
  }, [buildKit, frame, reduced, replay])

  if (now === null) return <div className="fixed inset-0 bg-background" />

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 overflow-hidden bg-background text-foreground"
    >
      <Scene
        els={elsRef}
        lit={litEvent(
          type,
          join === "open" ? "public" : "private",
          when === "soon",
          now
        )}
        Icon={Icon}
        title={title}
        when={when === "now" ? "live now" : "in 15 min"}
        chipWhen={when === "now" ? "now · 2h" : "in 15 min"}
        busy={phase === "playing"}
        onLight={light}
        now={now}
      />
      {showBar && phase !== "playing" && (
        <Bar
          open={panel}
          onToggle={() => setPanel((p) => !p)}
          type={type}
          join={join}
          when={when}
          flare={flare}
          api={api}
          motion={motion}
          speed={speed}
          theme={dark ? "dark" : "light"}
          duration={take.duration(reduced)}
          onSet={set}
          onTheme={setTheme}
          onScrub={(ms) => window.__takeover?.seek(ms)}
          onReplay={replay}
          done={phase === "done"}
        />
      )}
    </div>
  )
}

/**
 * The swap: the moment's pin goes and the map's pin shows, in one frame, at
 * the same place. The live pulse keeps its phase across the swap.
 */
function handover(els: SceneEls, done: boolean) {
  if (!els.hero || !els.mapPin) return
  els.hero.style.visibility = done ? "hidden" : ""
  els.mapPin.style.visibility = done ? "visible" : "hidden"
  if (!done) return
  const from = els.hero.querySelector(".animate-pulse-ring")?.getAnimations()[0]
  const to = els.mapPin.querySelector(".animate-pulse-ring")?.getAnimations()[0]
  if (from && to && from.startTime !== null) to.startTime = from.startTime
}

// ---- the controls ----------------------------------------------------------------

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
  open: boolean
  onToggle: () => void
  type: EventType
  join: "invite" | "open"
  when: "now" | "soon"
  flare: "first" | "later"
  api: Api
  motion: Motion
  speed: number
  theme: "light" | "dark"
  duration: number
  done: boolean
  onSet: (key: string, value: string) => void
  onTheme: (theme: string) => void
  onScrub: (ms: number) => void
  onReplay: () => void
}) {
  const { onSet } = props
  return (
    <div
      data-testid="takeover-bar"
      className="absolute inset-x-0 top-16 flex flex-col items-center gap-2 px-4"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={props.onToggle}
          aria-expanded={props.open}
          className="flex h-9 items-center gap-1 rounded-full bg-foreground px-4 text-xs font-medium text-background shadow-lg"
        >
          night flare · {props.flare} flare
          <CaretDownIcon className={cn("size-4", props.open && "rotate-180")} />
        </button>
        {props.done && (
          <button
            type="button"
            onClick={props.onReplay}
            className="flex h-9 items-center gap-1 rounded-full bg-foreground px-4 text-xs font-medium text-background shadow-lg"
          >
            <ArrowCounterClockwiseIcon className="size-4" />
            replay
          </button>
        )}
      </div>
      {props.open && (
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl bg-background/95 p-3 shadow-xl">
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
              {(["first", "later"] as const).map((k) => (
                <Chip
                  key={k}
                  on={props.flare === k}
                  onClick={() => onSet("flare", k)}
                >
                  {k} flare
                </Chip>
              ))}
            </Group>
            <Group>
              {(["invite", "open"] as const).map((k) => (
                <Chip
                  key={k}
                  on={props.join === k}
                  onClick={() => onSet("join", k)}
                >
                  {k === "invite" ? "invite only" : "open to all"}
                </Chip>
              ))}
            </Group>
          </div>
          <div className="flex flex-wrap gap-2">
            <Group>
              {(["now", "soon"] as const).map((k) => (
                <Chip
                  key={k}
                  on={props.when === k}
                  onClick={() => onSet("when", k)}
                >
                  {k === "now" ? "now" : "in 15 min"}
                </Chip>
              ))}
            </Group>
            <Group>
              {(["fast", "slow", "fail"] as const).map((k) => (
                <Chip
                  key={k}
                  on={props.api === k}
                  onClick={() => onSet("api", k)}
                >
                  {k === "fail" ? "api fails" : `api ${k}`}
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
                  {k === "full" ? "full motion" : k}
                </Chip>
              ))}
            </Group>
            <Group>
              {(["light", "dark"] as const).map((k) => (
                <Chip
                  key={k}
                  on={props.theme === k}
                  onClick={() => props.onTheme(k)}
                >
                  {k}
                </Chip>
              ))}
            </Group>
            <Group>
              {([1, 0.25] as const).map((k) => (
                <Chip
                  key={k}
                  on={props.speed === k}
                  onClick={() => onSet("speed", String(k))}
                >
                  {k === 1 ? "1×" : "¼×"}
                </Chip>
              ))}
            </Group>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            scrub
            <input
              type="range"
              min={0}
              max={props.duration}
              step={10}
              defaultValue={0}
              onChange={(e) => props.onScrub(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {(props.duration / 1000).toFixed(1)} s · swipe the strip to light, r
            replays
          </p>
        </div>
      )}
    </div>
  )
}
