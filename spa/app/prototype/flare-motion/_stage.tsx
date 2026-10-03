"use client"

// PROTOTYPE (#371) — throwaway. The lighting moment itself: a fuse runs along
// the outline of the flare's category icon, waits on the api, then the flare
// bursts alight. Gestures (_variant-hold / _variant-strike) drive it through
// the controller `useFlareMoment` returns.
//
// The fuse is the icon's own Phosphor path (regular weight), split into its
// subpaths and stroked in order with a dash offset, so every category gets a
// fuse for free and later flare art can swap in its own path.

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"
import {
  loadGsap,
  playBurnout,
  playBurst,
  type Gsap,
  type StageEls,
} from "./_burst"
import {
  CATEGORIES,
  createFlareMock,
  type Motion,
  type Settings,
} from "./_mock"

/** Seconds of holding to burn the whole fuse. */
export const HOLD_S = 1.4
/** Seconds a struck fuse takes to burn on its own. */
export const STRIKE_S = 1.1
const PARTICLES = 24

export type Phase =
  | "idle"
  | "burning"
  | "waiting"
  | "lit"
  | "failed"
  | "ending"
  | "ended"

type Anim = { kill: () => unknown }

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

// --- the controller -------------------------------------------------------

export type FlareMoment = ReturnType<typeof useFlareMoment>

export function useFlareMoment(settings: Settings, reduced: boolean) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [note, setNote] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  // The icon's own path data (filled layers) and the same split into its
  // subpaths (the fuse runs them one after another).
  const [shapes, setShapes] = useState<string[]>([])
  const subpaths = useMemo(
    () =>
      shapes
        .flatMap((d) => d.split(/(?=M)/))
        .map((d) => d.trim())
        .filter(Boolean),
    [shapes]
  )

  const els = useRef<Partial<StageEls>>({})
  const fusePaths = useRef<SVGPathElement[]>([])
  const sparkPos = useRef<SVGGElement | null>(null)
  const lens = useRef<number[]>([])
  const prog = useRef({ p: 0 })
  const lastSeg = useRef(-1)
  const holding = useRef(false)
  const live = useRef(new Set<Anim>())
  const phaseRef = useRef<Phase>("idle")

  const go = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const track = <T extends Anim>(a: T): T => {
    live.current.add(a)
    return a
  }
  const killAll = () => {
    for (const a of live.current) a.kill()
    live.current.clear()
  }

  // Read the category icon's path data from a hidden render of it.
  const probe = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return
    const ds = Array.from(node.querySelectorAll("path")).map(
      (p) => p.getAttribute("d") ?? ""
    )
    setShapes((prev) => (prev.join("|") === ds.join("|") ? prev : ds))
  }, [])

  // Measure the fuse and hide it before the first paint of each run.
  useLayoutEffect(() => {
    const paths = fusePaths.current.slice(0, subpaths.length)
    lens.current = paths.map((p) => p.getTotalLength())
    paths.forEach((p, i) => {
      const len = lens.current[i]
      p.style.strokeDasharray = `${len} ${len + 1}`
      p.style.strokeDashoffset = String(len)
      p.style.visibility = "hidden"
    })
    prog.current.p = 0
    lastSeg.current = -1
  }, [subpaths, run])

  /** Paint the fuse at progress p (0..1) along all subpaths in order. */
  const apply = useCallback(
    (p: number, opts: { quiet?: boolean } = {}) => {
      const paths = fusePaths.current.slice(0, lens.current.length)
      const fuse = els.current.fuse
      if (reduced) {
        // No travel: the whole outline brightens with progress.
        paths.forEach((path) => {
          path.style.strokeDashoffset = "0"
          path.style.visibility = p > 0 ? "visible" : "hidden"
        })
        if (fuse) fuse.style.opacity = String(p)
        if (sparkPos.current) sparkPos.current.style.visibility = "hidden"
        return
      }
      if (fuse) fuse.style.opacity = "1"
      const total = lens.current.reduce((a, b) => a + b, 0)
      let left = p * total
      // Subpaths burn in order, so the head is on the last one that has
      // started burning.
      let seg = -1
      let segBurnt = 0
      paths.forEach((path, i) => {
        const len = lens.current[i]
        const burnt = Math.max(0, Math.min(len, left))
        left -= len
        path.style.strokeDashoffset = String(len - burnt)
        path.style.visibility = burnt > 0 ? "visible" : "hidden"
        if (burnt > 0) {
          seg = i
          segBurnt = burnt
        }
      })
      const head = seg >= 0 ? paths[seg].getPointAtLength(segBurnt) : null
      const spark = sparkPos.current
      if (spark) {
        if (head) {
          const { x, y } = head
          spark.setAttribute("transform", `translate(${x} ${y})`)
          spark.style.visibility = "visible"
        } else {
          spark.style.visibility = "hidden"
        }
      }
      // A selection tick each time the fuse hops to the next subpath.
      if (seg !== lastSeg.current) {
        if (seg > 0 && !opts.quiet) void haptic("selection")
        lastSeg.current = seg
      }
    },
    [reduced]
  )

  const tweenProgress = (
    gsap: Gsap,
    to: number,
    duration: number,
    ease: string,
    onComplete?: () => void,
    quiet = false
  ) =>
    track(
      gsap.to(prog.current, {
        p: to,
        duration,
        ease,
        onUpdate: () => apply(prog.current.p, { quiet }),
        onComplete,
      })
    )

  const sparkInner = () => els.current.spark

  const fizzle = async (message: string) => {
    const gsap = await loadGsap()
    killAll()
    void haptic("light")
    setNote(message)
    const inner = sparkInner()
    if (inner && !reduced) {
      track(
        gsap.fromTo(
          inner,
          { opacity: 1 },
          {
            opacity: 0,
            duration: 0.35,
            ease: "steps(4)",
            onComplete: () => {
              gsap.set(inner, { opacity: 1 })
            },
          }
        )
      )
    }
    tweenProgress(
      gsap,
      0,
      reduced ? 0.15 : 0.2 + prog.current.p * 0.35,
      "power2.in",
      () => go("idle"),
      true
    )
  }

  const confirm = async () => {
    const gsap = await loadGsap()
    go("waiting")
    const glow = els.current.spark?.querySelector("circle")
    const pulse =
      glow && !reduced
        ? track(
            gsap.to(glow, {
              attr: { r: 34 },
              duration: 0.32,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            })
          )
        : null
    try {
      await createFlareMock(settings.api)
      pulse?.kill()
      if (phaseRef.current !== "waiting") return
      void haptic("success")
      go("lit")
      setNote(null)
      track(
        playBurst(gsap, els.current as StageEls, {
          burst: settings.burst,
          colour: settings.colour,
          who: settings.who,
          reduced,
        })
      )
    } catch {
      pulse?.kill()
      if (phaseRef.current !== "waiting") return
      void haptic("error")
      go("failed")
      setNote("couldn't light it. try again")
      const inner = sparkInner()
      if (inner && !reduced) {
        track(
          gsap.to(inner, {
            y: 30,
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
            onComplete: () => {
              gsap.set(inner, { y: 0, opacity: 1 })
            },
          })
        )
      }
      tweenProgress(gsap, 0, 0.5, "power2.in", undefined, true)
    }
  }

  const canStart = () =>
    phaseRef.current === "idle" || phaseRef.current === "failed"

  /** Hold variant: finger down. */
  const startHold = async () => {
    if (!canStart()) return
    holding.current = true
    go("burning")
    setNote(null)
    void haptic("selection")
    const gsap = await loadGsap()
    if (!holding.current) return
    killAll()
    const remaining = 1 - prog.current.p
    tweenProgress(gsap, 1, remaining * HOLD_S, "none", () => {
      holding.current = false
      void confirm()
    })
  }

  /** Hold variant: finger up (or cancelled) before the fuse reached the end. */
  const releaseHold = () => {
    if (!holding.current) return
    holding.current = false
    if (phaseRef.current !== "burning") return
    void fizzle("keep holding until it catches")
  }

  /** Strike variant: a swipe ended. `ok` = fast and far enough. */
  const strike = async (ok: boolean) => {
    if (!canStart()) return
    if (!ok) {
      go("idle")
      setNote("strike it faster")
      void haptic("light")
      return
    }
    go("burning")
    setNote(null)
    void haptic("medium")
    const gsap = await loadGsap()
    killAll()
    tweenProgress(gsap, 1, reduced ? 0.25 : STRIKE_S, "none", () => {
      void confirm()
    })
  }

  /** Play the ended state on a lit flare. */
  const burnOut = async () => {
    if (phaseRef.current !== "lit") return
    const gsap = await loadGsap()
    killAll()
    go("ending")
    void haptic("light")
    track(
      playBurnout(gsap, els.current as StageEls, {
        burnout: settings.burnout,
        reduced,
        retract: (tl) => {
          // Ember retreats: the fuse, fully burnt, runs back to its start.
          const fuse = els.current.fuse
          const inner = sparkInner()
          tl.add(() => {
            apply(1, { quiet: true })
            if (fuse) fuse.style.opacity = "1"
            if (inner) gsap.set(inner, { opacity: 1, scale: 0.7 })
          }, 0)
          if (fuse) tl.set(fuse, { opacity: 1 }, 0)
          tl.to(
            prog.current,
            {
              p: 0,
              duration: 1.4,
              ease: "power1.inOut",
              onUpdate: () => apply(prog.current.p, { quiet: true }),
            },
            0.05
          )
          if (inner) tl.to(inner, { opacity: 0, duration: 1.4 }, 0.05)
        },
      }).eventCallback("onComplete", () => go("ended"))
    )
  }

  /** Back to an unlit flare. Remounts the stage so nothing lingers. */
  const reset = () => {
    killAll()
    holding.current = false
    prog.current.p = 0
    setNote(null)
    go("idle")
    setRun((r) => r + 1)
  }

  /** Replay without a gesture (for review and screen recordings). */
  const autoplay = async () => {
    reset()
    // Let the remount land before striking.
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    phaseRef.current = "idle"
    await strike(true)
  }

  return {
    phase,
    note,
    run,
    shapes,
    subpaths,
    reduced,
    settings,
    probe,
    els,
    fusePaths,
    sparkPos,
    startHold,
    releaseHold,
    strike,
    burnOut,
    reset,
    autoplay,
  }
}

// --- the stage ------------------------------------------------------------

export function FlareStage({ moment }: { moment: FlareMoment }) {
  const {
    settings,
    shapes,
    subpaths,
    run,
    phase,
    els,
    fusePaths,
    sparkPos,
    probe,
  } = moment
  const uid = useId().replace(/:/g, "")
  const category =
    CATEGORIES.find((c) => c.key === settings.icon) ?? CATEGORIES[0]
  const Icon = category.icon
  const pin = settings.who === "invite" ? "--flare-invite" : "--flare-open"
  const litDisc = settings.colour === "pins" ? `var(${pin})` : "var(--primary)"
  const litInk =
    settings.colour === "pins" ? `var(${pin}-ink)` : "var(--primary-foreground)"

  const set =
    <K extends keyof StageEls>(key: K) =>
    (el: StageEls[K] | null) => {
      if (el) els.current[key] = el
    }

  const icon = (props: React.SVGProps<SVGPathElement>) =>
    shapes.map((d, i) => <path key={i} d={d} {...props} />)

  return (
    <div
      className="relative mx-auto size-60"
      data-testid="flare-stage"
      data-phase={phase}
    >
      {/* Hidden render of the category icon, to read its path data. */}
      <span
        key={category.key}
        ref={probe}
        aria-hidden
        className="pointer-events-none absolute size-0 overflow-hidden opacity-0"
      >
        <Icon weight="regular" />
      </span>

      <div
        ref={set("flash")}
        aria-hidden
        className="pointer-events-none absolute -inset-16 rounded-full opacity-0"
        style={{
          background:
            "radial-gradient(circle, var(--primary) 0%, transparent 62%)",
        }}
      />

      <svg
        key={run}
        viewBox="-24 -24 304 304"
        className="absolute inset-0 size-full overflow-visible"
        role="img"
        aria-label={`${category.label} flare`}
      >
        <defs>
          <radialGradient id={`glow-${uid}`}>
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle
          ref={set("disc")}
          cx={128}
          cy={128}
          r={122}
          fill={litDisc}
          opacity={0}
        />
        <circle
          ref={set("endedDisc")}
          cx={128}
          cy={128}
          r={122}
          fill="var(--muted)"
          opacity={0}
        />
        <circle
          ref={set("ring")}
          cx={128}
          cy={128}
          r={130}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={7}
          opacity={0}
        />
        {[0, 1].map((i) => (
          <circle
            key={i}
            ref={(el) => {
              if (!el) return
              const waves = (els.current.waves ??= [])
              waves[i] = el
            }}
            cx={128}
            cy={128}
            r={130}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={4}
            opacity={0}
          />
        ))}

        {/* The icon sits inside the disc with a margin, like a map pin. */}
        <g transform="translate(128 128) scale(0.7) translate(-128 -128)">
          <g ref={set("unlit")} fill="var(--muted-foreground)" opacity={0.3}>
            {icon({})}
          </g>
          <g
            ref={set("ended")}
            fill="var(--muted-foreground)"
            fillOpacity={0.6}
            opacity={0}
          >
            {icon({})}
          </g>
          <g
            ref={set("ash")}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray="0.1 14"
            opacity={0}
          >
            {icon({})}
          </g>
          <g ref={set("lit")} fill={litInk} opacity={0}>
            {icon({})}
          </g>

          <g
            ref={set("fuse")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {subpaths.map((d, i) => (
              <path
                key={i}
                d={d}
                ref={(el) => {
                  if (el) fusePaths.current[i] = el
                }}
                style={{ visibility: "hidden" }}
              />
            ))}
          </g>

          <g ref={sparkPos} style={{ visibility: "hidden" }}>
            <g ref={set("spark")}>
              <circle r={24} fill={`url(#glow-${uid})`} />
              <circle r={8} fill="var(--chart-1)" />
            </g>
          </g>
        </g>
      </svg>

      <div
        key={`p-${run}`}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2"
      >
        {Array.from({ length: PARTICLES }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              if (!el) return
              const ps = (els.current.particles ??= [])
              ps[i] = el
            }}
            className={cn("absolute top-0 left-0 rounded-full opacity-0")}
            style={{ width: 6, height: 6, marginLeft: -3, marginTop: -3 }}
          />
        ))}
      </div>
    </div>
  )
}
