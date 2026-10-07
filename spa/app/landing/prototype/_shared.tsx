"use client"
/* eslint-disable react-hooks/set-state-in-effect -- prototype: the screens restart their little animations when they come into view */

// PROTOTYPE (#506): shared pieces for the landing v2 directions. Throwaway.
// The app previews here are look-alikes built from the app's own tokens and
// its real FlarePin; the build swaps in real components with mock data.
// Motion is dependency-free (IntersectionObserver, scroll and pointer
// listeners writing CSS variables) so the prototype adds no package; the
// build decides between this and GSAP (#375).

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import {
  ArrowRightIcon,
  CheckIcon,
  FlameIcon,
  UsersIcon,
  WineIcon,
  type Icon,
} from "@/components/icons"
import { Backdrop, type Kind } from "@/components/intro-slides"
import { FlarePin, type FlarePinEvent } from "@/components/map-flare-pin"
import { PhoneQr } from "@/components/phone-qr"
import { cn } from "@/lib/utils"

export const APP_URL = "/"

// ---- art slots -----------------------------------------------------------------

/** Every image on the page is a named slot. Until Patrick's illustrations and
 * scene images land, each slot shows the intro's gradient art. */
export const ART_SLOTS = {
  hero: { placeholder: "what", alt: "too many apps, too many messages" },
  why: { placeholder: "why", alt: "someone alone with their phone" },
  together: { placeholder: "how", alt: "friends gathered around a flare" },
} satisfies Record<string, { placeholder: Kind; alt: string }>

export type ArtSlotName = keyof typeof ART_SLOTS

export function ArtSlot({
  name,
  className,
}: {
  name: ArtSlotName
  className?: string
}) {
  const slot = ART_SLOTS[name]
  return (
    <div
      role="img"
      aria-label={slot.alt}
      data-art-slot={name}
      className={cn("relative isolate overflow-hidden", className)}
    >
      <Backdrop kind={slot.placeholder} />
    </div>
  )
}

// ---- motion helpers -----------------------------------------------------------

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2)
  return (
    <div
      ref={ref}
      data-shown={inView}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("lp-reveal", className)}
    >
      {children}
    </div>
  )
}

/**
 * Writes `--p` on the element: 0 when its top meets the viewport's bottom,
 * 1 when its bottom leaves the top. No re-renders; CSS reads the variable.
 */
export function useScrollVar<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const total = box.height + window.innerHeight
      const p = Math.min(1, Math.max(0, (window.innerHeight - box.top) / total))
      el.style.setProperty("--p", p.toFixed(4))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])
  return ref
}

/**
 * Progress through a tall section whose inner part is sticky: 0 at the top,
 * 1 when its end reaches the viewport's bottom. Re-renders only when the
 * step (of `steps`) changes.
 */
export function useStickyStep<T extends HTMLElement>(steps: number) {
  const ref = useRef<T>(null)
  const [step, setStep] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const run = box.height - window.innerHeight
      const p = run > 0 ? Math.min(1, Math.max(0, -box.top / run)) : 0
      el.style.setProperty("--p", p.toFixed(4))
      setStep(Math.min(steps - 1, Math.floor(p * steps)))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [steps])
  return [ref, step] as const
}

/**
 * Writes `--mx` / `--my` (-1..1, from the pointer's position over the
 * window) on the element. Desktop pointers only; touch and reduced motion
 * leave both at 0.
 */
export function usePointerVar<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!fine.matches || reduced.matches) return
    let frame = 0
    let x = 0
    let y = 0
    const apply = () => {
      frame = 0
      el.style.setProperty("--mx", x.toFixed(3))
      el.style.setProperty("--my", y.toFixed(3))
    }
    const onMove = (event: PointerEvent) => {
      x = (event.clientX / window.innerWidth) * 2 - 1
      y = (event.clientY / window.innerHeight) * 2 - 1
      if (!frame) frame = requestAnimationFrame(apply)
    }
    window.addEventListener("pointermove", onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", onMove)
    }
  }, [])
  return ref
}

/** Hover spotlight: writes the pointer's position inside the element. */
export function spotlight(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget
  const box = el.getBoundingClientRect()
  el.style.setProperty("--sx", `${event.clientX - box.left}px`)
  el.style.setProperty("--sy", `${event.clientY - box.top}px`)
}

// ---- calls to action -------------------------------------------------------------

export function OpenSponti({ className }: { className?: string }) {
  return (
    <a
      href={APP_URL}
      data-landing-cta
      className={cn(
        "group inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground shadow-[0_8px_30px_-8px_var(--accent)] transition-[transform,background-color,box-shadow] outline-none hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_14px_40px_-10px_var(--accent)] focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        className
      )}
    >
      open sponti
      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}

export const DESKTOP_ONLY =
  "hidden [@media(hover:hover)_and_(pointer:fine)_and_(min-width:900px)]:flex"

export function DesktopQr({ className }: { className?: string }) {
  return (
    <div
      data-landing-qr
      className={cn(DESKTOP_ONLY, "items-center gap-4", className)}
    >
      <PhoneQr
        url={APP_URL}
        alt="qr code to open sponti"
        className="size-24 shrink-0 rounded-xl p-1.5"
      />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">made for your phone</p>
        <p className="text-sm text-muted-foreground">
          scan this to open sponti there.
        </p>
      </div>
    </div>
  )
}

/** The honest note: early testing, things may break, where to write. */
export function TestingNote({ className }: { className?: string }) {
  return (
    <p
      data-testing-note
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-flare-open"
      />
      <span>early testing in berlin. things may break.</span>
      <span>
        tell us at{" "}
        <a
          href="mailto:hello@sponti.fun"
          className="underline underline-offset-2 hover:text-foreground"
        >
          hello@sponti.fun
        </a>
      </span>
    </p>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
        <FlameIcon className="size-3.5" />
      </span>
      <span className="text-sm font-semibold">sponti</span>
    </span>
  )
}

// ---- the phone and its screens ---------------------------------------------------

export function Phone({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      style={style}
      className={cn(
        "relative aspect-[9/19] w-[17rem] shrink-0 rounded-[2.75rem] border border-border/80 bg-card p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]",
        className
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-background">
        <span
          aria-hidden="true"
          className="absolute top-2 left-1/2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black/80"
        />
        {children}
      </div>
    </div>
  )
}

export type Screen = "compose" | "map" | "join"

/** The three screens of the core loop, cross-fading as `screen` changes. */
export function LoopScreens({
  screen,
  play = true,
}: {
  screen: Screen
  play?: boolean
}) {
  return (
    <>
      {(["compose", "map", "join"] as const).map((s) => (
        <div
          key={s}
          aria-hidden={s !== screen}
          className={cn(
            "absolute inset-0 transition-[opacity,transform] duration-500 ease-out",
            s === screen
              ? "opacity-100"
              : "pointer-events-none scale-[0.98] opacity-0"
          )}
        >
          {s === "compose" && <ComposeScreen play={play && s === screen} />}
          {s === "map" && <MapScreen play={play && s === screen} />}
          {s === "join" && <JoinScreen play={play && s === screen} />}
        </div>
      ))}
    </>
  )
}

const MIN = 60_000

/** A fixed clock, so the pins' chips read the same on every visit. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])
  return now
}

function pins(now: number): (FlarePinEvent & { x: string; y: string })[] {
  const at = (m: number) => new Date(now + m * MIN).toISOString()
  return [
    {
      id: "canal",
      type: "drinks",
      visibility: "private",
      startAt: at(-20),
      endAt: at(100),
      x: "30%",
      y: "38%",
    },
    {
      id: "park",
      type: "hangout",
      visibility: "public",
      startAt: at(90),
      endAt: at(240),
      x: "66%",
      y: "24%",
    },
    {
      id: "food",
      type: "food",
      visibility: "private",
      startAt: at(30),
      endAt: at(120),
      x: "70%",
      y: "56%",
    },
  ]
}

/** A dark street map drawn in CSS: blocks, two big roads, a canal. */
function MapBase() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 270 570"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="270" height="570" className="fill-muted" />
      <g className="stroke-background" strokeWidth="2.5" fill="none">
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            x2="270"
            y1={i * 52 + 10}
            y2={i * 52 - 30}
          />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line
            key={`v${i}`}
            y1="0"
            y2="570"
            x1={i * 48 - 10}
            x2={i * 48 + 30}
          />
        ))}
      </g>
      <path
        d="M-10 330 C 60 300, 120 360, 280 300"
        className="stroke-flare-open/50"
        strokeWidth="9"
        fill="none"
      />
      <path
        d="M140 -10 L 120 580"
        className="stroke-foreground/15"
        strokeWidth="6"
        fill="none"
      />
      <rect
        x="170"
        y="120"
        width="70"
        height="50"
        rx="8"
        className="fill-flare-open/20"
      />
    </svg>
  )
}

export function MapScreen({ play = true }: { play?: boolean }) {
  const now = useNow()
  return (
    <div className="absolute inset-0">
      <MapBase />
      <div className="absolute inset-x-3 top-9 z-10 flex justify-center">
        <span className="rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium shadow">
          map · calendar
        </span>
      </div>
      {now !== null &&
        pins(now).map((pin, i) => (
          <div
            key={pin.id}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 transition-[opacity,transform] duration-500",
              play ? "scale-100 opacity-100" : "scale-50 opacity-0"
            )}
            style={{
              left: pin.x,
              top: pin.y,
              transitionDelay: play ? `${200 + i * 220}ms` : "0ms",
            }}
          >
            <FlarePin
              event={pin}
              own={false}
              joined={false}
              highlighted={i === 0}
              now={now}
            />
          </div>
        ))}
      <div
        className={cn(
          "absolute inset-x-3 bottom-4 z-10 transition-[opacity,transform] duration-500",
          play ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        )}
        style={{ transitionDelay: play ? "900ms" : "0ms" }}
      >
        <RailCard />
      </div>
    </div>
  )
}

/** The map's flare card, tinted by who can join (#493). */
export function RailCard({
  title = "drinks at the canal",
  meta = "by mia · 1.2 km · live",
  Icon = WineIcon,
  open = false,
  className,
}: {
  title?: string
  meta?: string
  Icon?: Icon
  open?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-l-[3px] border-l-accent p-3 shadow-lg",
        open
          ? "border-flare-open bg-flare-open-tint"
          : "border-flare-invite bg-flare-invite-tint",
        className
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          open
            ? "bg-flare-open text-flare-open-ink"
            : "bg-flare-invite text-flare-invite-ink"
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  )
}

const TYPED = "drinks at the canal"

export function ComposeScreen({ play = true }: { play?: boolean }) {
  const [chars, setChars] = useState(play ? 0 : TYPED.length)
  useEffect(() => {
    if (!play) return
    setChars(0)
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setChars(i)
      if (i >= TYPED.length) window.clearInterval(timer)
    }, 55)
    return () => window.clearInterval(timer)
  }, [play])
  const done = chars >= TYPED.length
  return (
    <div className="absolute inset-0 flex flex-col bg-background px-4 pt-12 pb-4">
      <p className="text-xs text-muted-foreground">light a flare</p>
      <p className="mt-1 min-h-6 text-base font-semibold">
        {TYPED.slice(0, chars)}
        <span className="ml-px inline-block h-4 w-px animate-pulse bg-foreground align-middle" />
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["hang out", "drinks", "food", "party"].map((label) => (
          <span
            key={label}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-300",
              label === "drinks" && done
                ? "border-transparent bg-card text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">when</p>
      <div className="mt-1.5 grid grid-cols-2 rounded-full bg-muted p-1 text-center text-[11px]">
        <span className="rounded-full bg-card py-1.5 font-medium text-primary">
          right now
        </span>
        <span className="py-1.5 text-muted-foreground">pick a time</span>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">who sees it</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs">
        <UsersIcon className="size-4 text-muted-foreground" />
        close friends · 6
      </div>
      <span
        className={cn(
          "mt-auto flex h-10 items-center justify-center gap-1.5 rounded-full bg-accent text-xs font-medium text-accent-foreground transition-transform duration-300",
          done && play ? "scale-[1.03]" : ""
        )}
      >
        <FlameIcon className="size-4" />
        light it
      </span>
    </div>
  )
}

const FACES = ["mia", "jo", "sam", "lu"]

export function JoinScreen({ play = true }: { play?: boolean }) {
  const [going, setGoing] = useState(play ? 1 : 4)
  const [joined, setJoined] = useState(!play)
  useEffect(() => {
    if (!play) return
    setGoing(1)
    setJoined(false)
    const timers = [
      window.setTimeout(() => setGoing(2), 500),
      window.setTimeout(() => setGoing(3), 1000),
      window.setTimeout(() => {
        setGoing(4)
        setJoined(true)
      }, 1700),
    ]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [play])
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="relative h-[42%] overflow-hidden">
        <MapBase />
      </div>
      <div className="relative z-10 -mt-6 flex flex-1 flex-col rounded-t-3xl bg-background px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-flare-invite text-flare-invite-ink">
            <WineIcon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              drinks at the canal with mia
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="mr-1 inline-block size-1.5 rounded-full bg-accent align-middle" />
              live · ends in 1h 40m
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <div className="flex -space-x-2">
            {FACES.slice(0, going).map((face, i) => (
              <span
                key={face}
                className="lp-pop flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold"
                style={{
                  background: [
                    "var(--flare-invite)",
                    "var(--flare-open)",
                    "var(--primary)",
                    "var(--muted)",
                  ][i],
                }}
              >
                {face[0]}
              </span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {going} going
          </span>
        </div>
        <span
          className={cn(
            "mt-auto flex h-10 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors duration-300",
            joined ? "bg-card text-primary" : "bg-accent text-accent-foreground"
          )}
        >
          {joined ? (
            <>
              <CheckIcon className="size-4" /> you&apos;re going
            </>
          ) : (
            "i'm in"
          )}
        </span>
      </div>
    </div>
  )
}

// ---- styles --------------------------------------------------------------------

export function PrototypeStyles() {
  return (
    <style>{`
      .lp-reveal { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1); }
      .lp-reveal[data-shown="true"] { opacity: 1; transform: none; }
      @keyframes lp-pop { from { transform: scale(.4); opacity: 0 } to { transform: none; opacity: 1 } }
      .lp-pop { animation: lp-pop .35s cubic-bezier(.3,1.4,.5,1) both; }
      @keyframes lp-float { 0%,100% { translate: 0 0 } 50% { translate: 0 -8px } }
      .lp-float { animation: lp-float 6s ease-in-out infinite; }
      @keyframes lp-caret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
      .lp-caret { animation: lp-caret 1s steps(1) infinite; }
      .lp-flare { box-shadow: 0 0 40px -12px var(--accent); transition: box-shadow .6s ease; }
      .lp-flare[data-lit="true"] { animation: lp-glow 2.4s ease-in-out .5s infinite; box-shadow: 0 0 90px 10px color-mix(in oklch, var(--accent) 55%, transparent), 0 0 30px 2px var(--accent); }
      @keyframes lp-glow { 0%,100% { box-shadow: 0 0 90px 10px color-mix(in oklch, var(--accent) 55%, transparent), 0 0 30px 2px var(--accent) } 50% { box-shadow: 0 0 130px 24px color-mix(in oklch, var(--accent) 40%, transparent), 0 0 40px 6px var(--accent) } }
      .lp-flare-ring { position: absolute; inset: 0; border-radius: 9999px; border: 2px solid var(--accent); opacity: 0; pointer-events: none; }
      .lp-flare[data-lit="true"] .lp-flare-ring { animation: lp-burst 1.1s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes lp-burst { from { transform: scale(1); opacity: .9 } to { transform: scale(2.4); opacity: 0 } }
      .lp-flare-icon { transition: transform .5s cubic-bezier(.3,1.6,.5,1); }
      .lp-flare[data-lit="true"] .lp-flare-icon { transform: scale(1.12); animation: lp-flicker 1.8s ease-in-out .6s infinite; transform-origin: 50% 85%; }
      @keyframes lp-flicker { 0%,100% { transform: scale(1.12) rotate(0) } 25% { transform: scale(1.16,1.08) rotate(-3deg) } 50% { transform: scale(1.1,1.16) rotate(2deg) } 75% { transform: scale(1.15,1.1) rotate(-1deg) } }
      @media (prefers-reduced-motion: reduce) {
        .lp-caret, .lp-flare[data-lit="true"], .lp-flare[data-lit="true"] .lp-flare-ring, .lp-flare[data-lit="true"] .lp-flare-icon { animation: none; }
        .lp-reveal { opacity: 1; transform: none; transition: none; }
        .lp-pop, .lp-float { animation: none; }
        [data-landing-v2] * { transition-duration: 0s !important; }
        [data-landing-v2] [style*="--p"] { --p: 0.5 !important; }
      }
    `}</style>
  )
}
