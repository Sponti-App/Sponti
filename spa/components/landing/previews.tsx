"use client"

// #506: the app, as the landing shows it. Look-alikes of the composer, the
// map and a flare's join sheet, built from the app's tokens and its real
// FlarePin, with fixed mock data: not interactive, no api. Each one plays a
// small animation when `play` turns on (the pin appears, the card slides up,
// the join count ticks). The phone frame sets the app's own colours (the
// `lp-app` / `lp-app-dark` classes in landing-styles.tsx), since the page
// around it uses the brand palette.

import { useEffect, useState, type ReactNode } from "react"
import {
  CheckIcon,
  FlameIcon,
  UsersIcon,
  WineIcon,
  type Icon,
} from "@/components/icons"
import { FlarePin, type FlarePinEvent } from "@/components/map-flare-pin"
import { cn } from "@/lib/utils"

export function Phone({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "lp-app relative aspect-[9/19] w-[17rem] shrink-0 rounded-[2.75rem] border border-border/80 bg-card p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]",
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

const MIN = 60_000

/** The clock the pins' chips read from, set after mounting so the static
 * page and the browser agree. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read the clock once, on the client
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

/** A street map drawn in SVG: blocks, two big roads, a canal, a park. */
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
    <div className="absolute inset-0 bg-background text-foreground">
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
function RailCard({
  title = "drinks at the canal",
  meta = "by mia · 1.2 km · live",
  Icon = WineIcon,
}: {
  title?: string
  meta?: string
  Icon?: Icon
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-l-[3px] border-flare-invite border-l-accent bg-flare-invite-tint p-3 shadow-lg">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-flare-invite text-flare-invite-ink">
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the typing each time it plays
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
    <div className="absolute inset-0 flex flex-col bg-background px-4 pt-12 pb-4 text-foreground">
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the join each time it plays
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
    <div className="absolute inset-0 flex flex-col bg-background text-foreground">
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
