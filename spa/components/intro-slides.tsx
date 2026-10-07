"use client"

// #377 (behind `introV2`): the intro slides a signed-out visitor sees on
// this device's first open of the home map. Three slides: what sponti is, why
// it exists, how lighting a flare works. Ported from the picked prototype
// (#373 round 3, PR #407, art A): full-bleed grainy gradients that drift
// slowly, abstract blurred figures, large quiet type, a full-width pill button
// and tappable progress dots.
//
// "look around" (the last slide), skip and Escape go to the map; "i have an
// account" goes to /login. Leaving any way marks the slides seen (see
// `lib/intro-slides.ts`). Swipe, the dots and the arrow keys move between
// slides. Under prefers-reduced-motion nothing moves, the grain included.
//
// The art is code-drawn: blurred SVG figures, CSS blobs for the gradient and
// icons from `@/components/icons` as the floating objects, under an SVG
// feTurbulence grain. No image files. The 30px titles are a deliberate
// exception to BRAND.md's type scale, for the intro only (#407).
//
// Loaded lazily by `intro-slides-gate.tsx`, so this file and its styles ship
// only to a visitor who is about to see them. The landing page (#467,
// `landing-page.tsx`) reuses the copy and the art: its root carries the
// `intro-slides` class for the figures' colour.

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  AtIcon,
  BellIcon,
  CalendarBlankIcon,
  ChatIcon,
  ChatTextIcon,
  EnvelopeIcon,
  FlameIcon,
  MegaphoneIcon,
  type Icon,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

export type Kind = "what" | "why" | "how"

const SLIDES: readonly Kind[] = ["what", "why", "how"]

const SWIPE_MIN_PX = 48

/** The WHO report the why slide cites, the slides' only source. */
export const WHO_REPORT_URL =
  "https://www.who.int/publications/i/item/978240112360"

// ---- copy --------------------------------------------------------------------

export const INTRO_COPY: Record<
  Kind,
  { eyebrow: string; title: string; body: string }
> = {
  what: {
    eyebrow: "what sponti is",
    title: "plans with friends, right now or soon",
    body: "overwhelmed by messengers, group chats, event pages, calendars and email? sponti is for you. don't take our word for it: give it a try.",
  },
  why: {
    eyebrow: "why it exists",
    title: "we're more connected than ever, and more alone",
    body: "messages everywhere, and still no time to catch up with your best friends. step back from the feed, and you miss the thing you wanted to go to.",
  },
  how: {
    eyebrow: "how it works",
    title: "light a flare",
    body: "let the people you want to see know what you're up to, so they can join.",
  },
}

// ---- palette -----------------------------------------------------------------

// Sponti's tokens, so both themes come for free: peach (the accent), plum and
// teal (the pin tints), cream / navy (the background).
const PEACH = "var(--primary)"
const PLUM = "var(--flare-invite)"
const PLUM_INK = "var(--flare-invite-ink)"
const TEAL = "var(--flare-open)"
const TEAL_INK = "var(--flare-open-ink)"
const BG = "var(--background)"
/** The lone figures: dark plum on cream, a plum shade on navy. */
const SILHOUETTE = "var(--intro-silhouette)"
const mix = (a: string, pct: number, b: string) =>
  `color-mix(in oklch, ${a} ${pct}%, ${b})`

type Blob = {
  color: string
  /** Position and size, in % of the screen. */
  x: number
  y: number
  size: number
  drift: "a" | "b" | "c"
  seconds: number
}

const blob = (
  color: string,
  x: number,
  y: number,
  size: number,
  drift: Blob["drift"],
  seconds: number
): Blob => ({ color, x, y, size, drift, seconds })

const BLOBS: Record<Kind, Blob[]> = {
  what: [
    blob(mix(PEACH, 70, BG), -30, -20, 120, "a", 26),
    blob(mix(PLUM, 85, BG), 30, 5, 110, "b", 32),
    blob(mix(TEAL, 70, BG), -40, 40, 100, "c", 29),
  ],
  why: [
    blob(mix(PLUM_INK, 30, BG), -20, -30, 140, "b", 34),
    blob(mix(PLUM, 70, BG), 20, 25, 110, "a", 30),
    blob(mix(TEAL_INK, 18, BG), -50, 10, 100, "c", 38),
  ],
  how: [
    blob(mix(PEACH, 85, BG), -10, 0, 110, "a", 24),
    blob(mix(TEAL, 90, BG), -55, -25, 105, "c", 28),
    blob(mix(PLUM, 90, BG), 35, -20, 105, "b", 31),
    blob(mix(PEACH, 50, PLUM), 20, 35, 90, "c", 27),
  ],
}

// ---- screens -----------------------------------------------------------------

export function IntroSlides({ onLeave }: { onLeave: () => void }) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const kind = SLIDES[index]
  const last = index === SLIDES.length - 1
  const copy = INTRO_COPY[kind]

  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), SLIDES.length - 1)
    if (clamped === index) return
    haptic("selection")
    setIndex(clamped)
  }

  /** "look around", skip and Escape: to the map. */
  const lookAround = () => {
    haptic("light")
    onLeave()
  }

  const signIn = () => {
    haptic("selection")
    router.push("/login")
    onLeave()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") go(index + 1)
    else if (event.key === "ArrowLeft") go(index - 1)
    else if (event.key === "Escape") lookAround()
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="welcome to sponti"
      tabIndex={-1}
      data-intro-slide={kind}
      onKeyDown={onKeyDown}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (dx <= -SWIPE_MIN_PX) go(index + 1)
        else if (dx >= SWIPE_MIN_PX) go(index - 1)
      }}
      className="intro-slides fixed inset-0 isolate z-[55] flex flex-col overflow-hidden bg-background text-foreground outline-none"
    >
      <IntroStyles />
      <Backdrop kind={kind} />

      <header className="relative flex items-center justify-between px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
            <FlameIcon className="size-3.5" />
          </span>
          <span className="text-sm font-semibold">sponti</span>
        </div>
        {!last && (
          <button
            type="button"
            onClick={lookAround}
            className="min-h-11 px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            skip
          </button>
        )}
      </header>

      <div className="relative mt-auto flex flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* A scrim that follows the copy block on the how slide, whose crowd
            runs under the copy, so the type reads over the art on any screen
            height (#498): clear above the eyebrow, solid under the text. It
            sits in the backdrop's layer, painted after it. The other slides'
            art ends above the copy, and a scrim would cut it. */}
        {kind === "how" && (
          <div
            aria-hidden
            data-intro-scrim
            className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 -z-10"
            style={{
              background: `linear-gradient(to bottom, transparent, ${mix(BG, 55, "transparent")} 3rem, ${BG} 5.5rem)`,
            }}
          />
        )}
        <div key={kind} className="intro-in" aria-live="polite">
          <p className="text-sm font-medium text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-medium tracking-tight text-balance">
            {copy.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{copy.body}</p>
          {kind === "why" && <Source />}
          {kind === "how" && <NowOrSoon />}
        </div>

        <Dots index={index} onPick={go} />

        <div className="mt-5 flex flex-col gap-1">
          {last ? (
            <Button
              type="button"
              onClick={lookAround}
              className="h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
            >
              look around
              <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => go(index + 1)}
              className="h-12 w-full rounded-full bg-foreground text-sm text-background hover:bg-foreground/90"
            >
              next
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
          <button
            type="button"
            onClick={signIn}
            className="min-h-11 w-full text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            i have an account
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Dots({
  index,
  onPick,
}: {
  index: number
  onPick: (i: number) => void
}) {
  const count = SLIDES.length
  return (
    <div
      className="mt-6 flex items-center justify-center gap-2"
      role="group"
      aria-label="intro progress"
    >
      {SLIDES.map((kind, i) => (
        <button
          key={kind}
          type="button"
          aria-current={i === index ? "step" : undefined}
          aria-label={`slide ${i + 1} of ${count}`}
          onClick={() => onPick(i)}
          className="flex h-6 items-center px-0.5"
        >
          <span
            className={cn(
              "h-1.5 rounded-full transition-all duration-500 motion-reduce:transition-none",
              i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** The why slide's source. */
export function Source() {
  return (
    <p className="mt-3 text-xs text-muted-foreground/80">
      source:{" "}
      <a
        href={WHO_REPORT_URL}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        who commission on social connection (2025)
      </a>
    </p>
  )
}

/** The how slide's two kinds of flare, as glass rows on the art. They are an
 * illustration, not data: nothing here is loaded. */
function NowOrSoon() {
  const glass =
    "border-border/60 bg-card/70 backdrop-blur-md supports-[backdrop-filter]:bg-card/55"
  return (
    <div className="mt-5 flex flex-col gap-3" aria-hidden>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          right now
        </p>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border border-l-[3px] border-l-accent p-3",
            glass
          )}
        >
          <span className="flex w-14 shrink-0 items-center gap-1.5 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            live
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">drinks at the canal</p>
            <p className="truncate text-xs text-muted-foreground">
              by mia · ends in 1h 40m
            </p>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          pick a time
        </p>
        <div
          className={cn("flex items-center gap-3 rounded-xl border p-3", glass)}
        >
          <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
            tomorrow
            <br />
            14:00
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              flea market at mauerpark
            </p>
            <p className="truncate text-xs text-muted-foreground">
              mauerpark · 5 going
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- the art -----------------------------------------------------------------

export function Backdrop({ kind }: { kind: Kind }) {
  const figureBox =
    kind === "how" ? "aspect-[390/360] top-6" : "aspect-[390/480] top-4"
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <Gradient kind={kind} />
      <div
        className={cn(
          "absolute inset-x-0 mx-auto w-full max-w-md [mask-image:linear-gradient(to_bottom,black_60%,transparent_96%)]",
          figureBox
        )}
      >
        {kind === "what" && <WhatFigure />}
        {kind === "why" && <WhyFigure />}
        {kind === "how" && <HowFigure />}
      </div>
      <Grain />
      {/* Fades the art into the page under the type. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background: `linear-gradient(to top, ${BG} 45%, ${mix(BG, 70, "transparent")} 75%, transparent)`,
        }}
      />
    </div>
  )
}

function Gradient({ kind }: { kind: Kind }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {BLOBS[kind].map((b, i) => (
        <div
          key={i}
          className={`intro-drift-${b.drift} absolute rounded-full`}
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.size}%`,
            aspectRatio: "1",
            background: `radial-gradient(closest-side, ${b.color}, transparent)`,
            animationDuration: `${b.seconds}s`,
          }}
        />
      ))}
    </div>
  )
}

/** Film grain: SVG fractal noise, blended into whatever is under it. The
 * noise renders once into a layer a little bigger than the screen, and only
 * that layer's transform moves, so the phone composites it instead of
 * re-running feTurbulence every frame. It sits outside the per-slide art, so
 * changing slides doesn't render it again. */
function Grain() {
  const id = `grain-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  return (
    <div className="absolute inset-0 overflow-hidden opacity-45 mix-blend-overlay dark:opacity-35 dark:mix-blend-soft-light">
      <svg className="intro-grain absolute -inset-[6%] size-[112%]" aria-hidden>
        <filter id={id}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </div>
  )
}

// ---- figures -----------------------------------------------------------------

/** One blurred head-and-shoulders, standing on (x, y). */
function Bust({
  x,
  y,
  scale = 1,
  fill,
  filter,
  className,
  delay,
}: {
  x: number
  y: number
  scale?: number
  fill: string
  filter?: string
  className?: string
  delay?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g
        className={className}
        style={{ fill, animationDelay: delay ? `${delay}s` : undefined }}
        filter={filter}
      >
        <ellipse cx="0" cy="-118" rx="40" ry="48" />
        <rect x="-16" y="-80" width="32" height="30" rx="10" />
        <path d="M -100 40 C -100 -24 -64 -58 0 -58 C 64 -58 100 -24 100 40 Z" />
      </g>
    </g>
  )
}

function useBlurs(levels: number[]) {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const ids = levels.map((_, i) => `blur-${base}-${i}`)
  const defs = (
    <defs>
      {levels.map((sd, i) => (
        <filter
          key={sd}
          id={ids[i]}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation={sd} />
        </filter>
      ))}
    </defs>
  )
  return { defs, url: (i: number) => `url(#${ids[i]})` }
}

type Thing = {
  Icon?: Icon
  x: number
  y: number
  size: number
  tone: string
  ink: string
  blur: number
  /** Float cycle and offset, in seconds. */
  s: number
  d: number
}

/** The what slide's noise: messengers, mail, calendars, pings. */
const THINGS: Thing[] = [
  {
    Icon: ChatIcon,
    x: 16,
    y: 34,
    size: 44,
    tone: PLUM,
    ink: PLUM_INK,
    blur: 0,
    s: 9,
    d: 0,
  },
  {
    Icon: EnvelopeIcon,
    x: 78,
    y: 26,
    size: 48,
    tone: TEAL,
    ink: TEAL_INK,
    blur: 0.5,
    s: 11,
    d: -3,
  },
  {
    Icon: CalendarBlankIcon,
    x: 60,
    y: 9,
    size: 40,
    tone: mix(PEACH, 70, BG),
    ink: PLUM_INK,
    blur: 1,
    s: 10,
    d: -6,
  },
  {
    Icon: BellIcon,
    x: 88,
    y: 54,
    size: 36,
    tone: PLUM,
    ink: PLUM_INK,
    blur: 1.5,
    s: 8,
    d: -2,
  },
  {
    Icon: AtIcon,
    x: 9,
    y: 60,
    size: 34,
    tone: TEAL,
    ink: TEAL_INK,
    blur: 1.5,
    s: 12,
    d: -5,
  },
  {
    Icon: ChatTextIcon,
    x: 32,
    y: 13,
    size: 36,
    tone: TEAL,
    ink: TEAL_INK,
    blur: 2,
    s: 9,
    d: -7,
  },
  {
    Icon: MegaphoneIcon,
    x: 74,
    y: 44,
    size: 30,
    tone: mix(PEACH, 70, BG),
    ink: PLUM_INK,
    blur: 0.5,
    s: 13,
    d: -4,
  },
  { x: 46, y: 3, size: 14, tone: PLUM, ink: PLUM_INK, blur: 1, s: 7, d: -1 },
  {
    x: 26,
    y: 46,
    size: 12,
    tone: mix(PEACH, 80, BG),
    ink: PLUM_INK,
    blur: 0.5,
    s: 8,
    d: -3,
  },
  { x: 92, y: 18, size: 10, tone: TEAL, ink: TEAL_INK, blur: 1, s: 9, d: -6 },
  {
    x: 6,
    y: 20,
    size: 16,
    tone: mix(PEACH, 70, BG),
    ink: PLUM_INK,
    blur: 2.5,
    s: 10,
    d: -2,
  },
]

/** What: a head surrounded by little floating things, the noise. */
function WhatFigure() {
  const { defs, url } = useBlurs([6])
  return (
    <div className="relative size-full">
      <svg viewBox="0 0 390 480" className="absolute inset-0 size-full">
        {defs}
        <Bust x={195} y={430} scale={1.15} fill={SILHOUETTE} filter={url(0)} />
      </svg>
      {THINGS.map((t, i) => (
        <span
          key={i}
          className="intro-float absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl shadow-sm"
          style={{
            left: `${t.x}%`,
            top: `${t.y}%`,
            width: t.size,
            height: t.size,
            borderRadius: t.Icon ? undefined : "9999px",
            background: t.tone,
            color: t.ink,
            filter: t.blur ? `blur(${t.blur}px)` : undefined,
            animationDuration: `${t.s}s`,
            animationDelay: `${t.d}s`,
          }}
        >
          {t.Icon && <t.Icon className="size-1/2" />}
        </span>
      ))}
    </div>
  )
}

/** Why: one person, softly lit by a phone. */
function WhyFigure() {
  const { defs, url } = useBlurs([5, 14, 2])
  const glow = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  return (
    <svg viewBox="0 0 390 480" className="absolute inset-0 size-full">
      {defs}
      <defs>
        <radialGradient id={glow}>
          <stop
            offset="0%"
            stopColor={mix(PEACH, 60, "white")}
            stopOpacity="0.9"
          />
          <stop offset="100%" stopColor={PEACH} stopOpacity="0" />
        </radialGradient>
      </defs>
      <Bust x={195} y={360} scale={1} fill={SILHOUETTE} filter={url(0)} />
      {/* The light on the face, from below. */}
      <ellipse
        className="intro-breathe"
        cx="195"
        cy="285"
        rx="110"
        ry="120"
        fill={`url(#${glow})`}
        filter={url(1)}
        style={{ mixBlendMode: "screen" }}
      />
      {/* The phone. */}
      <rect
        x="177"
        y="318"
        width="36"
        height="56"
        rx="7"
        transform="rotate(-8 195 346)"
        fill={mix(PEACH, 35, "white")}
        filter={url(2)}
      />
    </svg>
  )
}

const CROWD = {
  back: [
    { x: 40, c: mix(TEAL, 70, BG) },
    { x: 120, c: mix(PLUM, 80, BG) },
    { x: 205, c: mix(PEACH, 60, BG) },
    { x: 285, c: mix(TEAL, 80, BG) },
    { x: 360, c: mix(PLUM, 70, BG) },
  ],
  mid: [
    { x: 0, c: PLUM },
    { x: 90, c: mix(PEACH, 85, PLUM) },
    { x: 180, c: TEAL },
    { x: 270, c: mix(PLUM, 80, PLUM_INK) },
    { x: 370, c: mix(PEACH, 80, BG) },
  ],
  front: [
    { x: 50, c: mix(TEAL_INK, 60, TEAL) },
    { x: 195, c: mix(PEACH, 90, PLUM_INK) },
    { x: 340, c: mix(PLUM_INK, 55, PLUM) },
  ],
}

/** How: a blurred, colourful crowd, gathered round a flare. */
function HowFigure() {
  const { defs, url } = useBlurs([9, 6, 4, 7])
  const flame = `flame-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  return (
    <svg viewBox="0 0 390 360" className="absolute inset-0 size-full">
      {defs}
      <defs>
        <linearGradient id={flame} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={PEACH} />
          <stop offset="55%" stopColor={mix(PEACH, 75, PLUM)} />
          <stop
            offset="100%"
            stopColor={mix(PEACH, 50, PLUM)}
            stopOpacity="0.8"
          />
        </linearGradient>
      </defs>
      {/* The flare: a soft flame behind the crowd, drifting with the
          gradient. */}
      <g className="intro-flame" filter={url(3)}>
        <path
          d="M195 14 C222 66 270 104 268 166 C266 218 234 248 195 248 C156 248 124 218 122 170 C120 128 148 104 158 70 C168 96 178 104 184 112 C184 80 182 50 195 14 Z"
          fill={`url(#${flame})`}
          opacity="0.95"
        />
        <path
          d="M196 92 C212 124 236 148 234 186 C232 216 216 236 196 236 C176 236 160 216 160 190 C160 160 182 140 196 92 Z"
          fill={mix(PEACH, 45, "white")}
          opacity="0.85"
        />
      </g>
      {CROWD.back.map((p, i) => (
        <Bust
          key={`b${i}`}
          x={p.x}
          y={210}
          scale={0.5}
          fill={p.c}
          filter={url(0)}
          className="intro-sway"
          delay={-i * 1.7}
        />
      ))}
      {CROWD.mid.map((p, i) => (
        <Bust
          key={`m${i}`}
          x={p.x}
          y={268}
          scale={0.72}
          fill={p.c}
          filter={url(1)}
          className="intro-sway"
          delay={-i * 2.3 - 1}
        />
      ))}
      {CROWD.front.map((p, i) => (
        <Bust
          key={`f${i}`}
          x={p.x}
          y={340}
          scale={0.98}
          fill={p.c}
          filter={url(2)}
          className="intro-sway"
          delay={-i * 3.1 - 2}
        />
      ))}
    </svg>
  )
}

// ---- motion --------------------------------------------------------------------

/** Slow and calm. Nothing moves under prefers-reduced-motion. Inline, so the
 * styles ship in this lazy chunk and not in the app's global css. */
export function IntroStyles() {
  return (
    <style>{`
      .intro-slides { --intro-silhouette: color-mix(in oklch, var(--foreground) 72%, var(--flare-invite-ink)); }
      .dark .intro-slides { --intro-silhouette: color-mix(in oklch, var(--flare-invite) 80%, var(--background)); }

      .intro-in { animation: intro-in 280ms cubic-bezier(0.32, 0.72, 0, 1); }
      @keyframes intro-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

      .intro-drift-a, .intro-drift-b, .intro-drift-c {
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
        will-change: transform;
      }
      .intro-drift-a { animation-name: intro-drift-a; }
      .intro-drift-b { animation-name: intro-drift-b; }
      .intro-drift-c { animation-name: intro-drift-c; }
      @keyframes intro-drift-a { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(12%,8%,0) scale(1.15); } }
      @keyframes intro-drift-b { from { transform: translate3d(0,0,0) scale(1.08); } to { transform: translate3d(-14%,6%,0) scale(0.94); } }
      @keyframes intro-drift-c { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(10%,-10%,0) scale(1.12); } }

      .intro-flame { animation: intro-flame 14s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 100%; }
      @keyframes intro-flame {
        0% { transform: translate(-6px, 0) scale(0.97, 0.95) rotate(-2deg); }
        50% { transform: translate(2px, -4px) scale(1.02, 1.04) rotate(1deg); }
        100% { transform: translate(6px, -2px) scale(0.99, 1.01) rotate(2.5deg); }
      }

      .intro-grain { animation: intro-grain 40s linear infinite alternate; will-change: transform; }
      @keyframes intro-grain { from { transform: translate3d(-2%, -1.5%, 0); } to { transform: translate3d(2%, 1.5%, 0); } }

      .intro-float { animation: intro-float 9s ease-in-out infinite alternate; }
      @keyframes intro-float {
        from { translate: -50% calc(-50% - 7px); rotate: -4deg; }
        to { translate: -50% calc(-50% + 7px); rotate: 4deg; }
      }

      .intro-sway { animation: intro-sway 9s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 100%; }
      @keyframes intro-sway { from { transform: translateX(-4px) rotate(-1.2deg); } to { transform: translateX(4px) rotate(1.2deg); } }

      .intro-breathe { animation: intro-breathe 7s ease-in-out infinite alternate; }
      @keyframes intro-breathe { from { opacity: 0.7; } to { opacity: 1; } }

      @media (prefers-reduced-motion: reduce) {
        .intro-in, .intro-drift-a, .intro-drift-b, .intro-drift-c,
        .intro-float, .intro-sway, .intro-breathe, .intro-flame,
        .intro-grain { animation: none; }
      }
    `}</style>
  )
}
