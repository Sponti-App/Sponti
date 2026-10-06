"use client"

// PROTOTYPE (#373) — the intro slides, round 3. Three slides: what sponti is,
// why it exists, how to light a flare. Calm and trustworthy: full-bleed grainy
// gradients that drift slowly, abstract blurred figures, large quiet type, a
// full-width pill button and progress dots. Still under prefers-reduced-motion.
//
// The art is code-drawn (Patrick's pick, art A): blurred SVG/CSS shapes plus
// an SVG feTurbulence grain, no image files.

import { useId, useRef } from "react"
import {
  ArrowRightIcon,
  AtIcon,
  BellIcon,
  CalendarBlankIcon,
  ChatIcon,
  ChatTextIcon,
  EnvelopeIcon,
  MegaphoneIcon,
  type Icon,
} from "@/components/icons"
import { timeLeftLabel } from "@/components/map-flare-pin"
import { cn } from "@/lib/utils"
import { SOON, mockFlares } from "./_mock"
import {
  BrandMark,
  CalendarRow,
  InkButton,
  PeachButton,
  TextButton,
} from "./_shared"

type Kind = "what" | "why" | "how"

export const SLIDES: { id: Kind }[] = [
  { id: "what" },
  { id: "why" },
  { id: "how" },
]

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

const BLOBS: Record<Kind, Blob[]> = {
  what: [
    {
      color: mix(PEACH, 70, BG),
      x: -30,
      y: -20,
      size: 120,
      drift: "a",
      seconds: 26,
    },
    {
      color: mix(PLUM, 85, BG),
      x: 30,
      y: 5,
      size: 110,
      drift: "b",
      seconds: 32,
    },
    {
      color: mix(TEAL, 70, BG),
      x: -40,
      y: 40,
      size: 100,
      drift: "c",
      seconds: 29,
    },
  ],
  why: [
    {
      color: mix(PLUM_INK, 30, BG),
      x: -20,
      y: -30,
      size: 140,
      drift: "b",
      seconds: 34,
    },
    {
      color: mix(PLUM, 70, BG),
      x: 20,
      y: 25,
      size: 110,
      drift: "a",
      seconds: 30,
    },
    {
      color: mix(TEAL_INK, 18, BG),
      x: -50,
      y: 10,
      size: 100,
      drift: "c",
      seconds: 38,
    },
  ],
  how: [
    {
      color: mix(PEACH, 85, BG),
      x: -10,
      y: 0,
      size: 110,
      drift: "a",
      seconds: 24,
    },
    {
      color: mix(TEAL, 90, BG),
      x: -55,
      y: -25,
      size: 105,
      drift: "c",
      seconds: 28,
    },
    {
      color: mix(PLUM, 90, BG),
      x: 35,
      y: -20,
      size: 105,
      drift: "b",
      seconds: 31,
    },
    {
      color: mix(PEACH, 50, PLUM),
      x: 20,
      y: 35,
      size: 90,
      drift: "c",
      seconds: 27,
    },
  ],
}

// ---- copy --------------------------------------------------------------------

const COPY: Record<Kind, { eyebrow: string; title: string; body: string }> = {
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

// ---- screens -----------------------------------------------------------------

export function Slides({
  index,
  now,
  go,
  onDone,
  onSignIn,
}: {
  index: number
  now: number
  go: (i: number) => void
  /** "look around": to the map. */
  onDone: () => void
  onSignIn: () => void
}) {
  const i = Math.min(Math.max(index, 0), SLIDES.length - 1)
  const kind = SLIDES[i].id
  const last = i === SLIDES.length - 1
  const copy = COPY[kind]
  const touchX = useRef<number | null>(null)

  return (
    <div
      className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (dx <= -48 && !last) go(i + 1)
        else if (dx >= 48 && i > 0) go(i - 1)
      }}
    >
      <IntroStyles />
      <Backdrop kind={kind} />

      <header className="relative flex items-center justify-between px-6 pt-3">
        <BrandMark />
        {!last && (
          <button
            type="button"
            onClick={onDone}
            className="min-h-11 text-sm font-medium text-muted-foreground"
          >
            skip
          </button>
        )}
      </header>

      <div className="relative mt-auto flex flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div key={kind} className="proto-in">
          <p className="text-sm font-medium text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-medium tracking-tight text-balance">
            {copy.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{copy.body}</p>
          {kind === "why" && <Sources />}
          {kind === "how" && <NowOrSoon now={now} />}
        </div>

        <Dots count={SLIDES.length} index={i} onPick={go} />

        <div className="mt-5 flex flex-col gap-1">
          {last ? (
            <PeachButton onClick={onDone}>
              look around
              <ArrowRightIcon className="size-4" />
            </PeachButton>
          ) : (
            <InkButton onClick={() => go(i + 1)}>
              next
              <ArrowRightIcon className="size-4" />
            </InkButton>
          )}
          <TextButton onClick={onSignIn}>i have an account</TextButton>
        </div>
      </div>
    </div>
  )
}

function Dots({
  count,
  index,
  onPick,
}: {
  count: number
  index: number
  onPick: (i: number) => void
}) {
  return (
    <div
      className="mt-6 flex items-center justify-center gap-2"
      role="tablist"
      aria-label="intro progress"
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === index}
          aria-label={`slide ${i + 1} of ${count}`}
          onClick={() => onPick(i)}
          className="flex h-6 items-center"
        >
          <span
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** The why slide's source. */
function Sources() {
  return (
    <p className="mt-3 text-xs text-muted-foreground/80">
      source:{" "}
      <a
        href="https://www.who.int/publications/i/item/978240112360"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        who commission on social connection (2025)
      </a>
    </p>
  )
}

/** Take C's two rows, restyled to sit on the art. */
function NowOrSoon({ now }: { now: number }) {
  const [canal] = mockFlares(now)
  const [soon] = SOON
  const glass =
    "border-border/60 bg-card/70 backdrop-blur-md supports-[backdrop-filter]:bg-card/55"
  return (
    <div className="mt-5 flex flex-col gap-3">
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
            <p className="truncate text-sm font-medium">{canal.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              by mia · ends in{" "}
              {timeLeftLabel(new Date(canal.endAt).getTime() - now)}
            </p>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          pick a time
        </p>
        <CalendarRow
          event={soon.flare(now)}
          day={soon.day}
          time="14:00"
          className={glass}
        />
      </div>
    </div>
  )
}

// ---- the art -----------------------------------------------------------------

function Backdrop({ kind }: { kind: Kind }) {
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

function Gradient({ kind, className }: { kind: Kind; className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
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
 * re-running feTurbulence every frame. */
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

/** What: a head surrounded by little floating things, the noise. */
function WhatFigure() {
  const { defs, url } = useBlurs([6])
  const things: {
    Icon?: Icon
    x: number
    y: number
    size: number
    tone: string
    ink: string
    blur: number
    s: number
    d: number
  }[] = [
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
  return (
    <div className="relative size-full">
      <svg viewBox="0 0 390 480" className="absolute inset-0 size-full">
        {defs}
        <Bust x={195} y={430} scale={1.15} fill={SILHOUETTE} filter={url(0)} />
      </svg>
      {things.map((t, i) => (
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

/** How: a blurred, colourful crowd, gathered round a flare. */
function HowFigure() {
  const { defs, url } = useBlurs([9, 6, 4, 7])
  const flame = `flame-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const back = [
    { x: 40, c: mix(TEAL, 70, BG) },
    { x: 120, c: mix(PLUM, 80, BG) },
    { x: 205, c: mix(PEACH, 60, BG) },
    { x: 285, c: mix(TEAL, 80, BG) },
    { x: 360, c: mix(PLUM, 70, BG) },
  ]
  const mid = [
    { x: 0, c: PLUM },
    { x: 90, c: mix(PEACH, 85, PLUM) },
    { x: 180, c: TEAL },
    { x: 270, c: mix(PLUM, 80, PLUM_INK) },
    { x: 370, c: mix(PEACH, 80, BG) },
  ]
  const front = [
    { x: 50, c: mix(TEAL_INK, 60, TEAL) },
    { x: 195, c: mix(PEACH, 90, PLUM_INK) },
    { x: 340, c: mix(PLUM_INK, 55, PLUM) },
  ]
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
      {back.map((p, i) => (
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
      {mid.map((p, i) => (
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
      {front.map((p, i) => (
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

/** Slow and calm. Nothing moves under prefers-reduced-motion. */
function IntroStyles() {
  return (
    <style>{`
      :root { --intro-silhouette: color-mix(in oklch, var(--foreground) 72%, var(--flare-invite-ink)); }
      html.dark { --intro-silhouette: color-mix(in oklch, var(--flare-invite) 80%, var(--background)); }
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
        .intro-drift-a, .intro-drift-b, .intro-drift-c,
        .intro-float, .intro-sway, .intro-breathe, .intro-flame,
        .intro-grain { animation: none; }
      }
    `}</style>
  )
}
