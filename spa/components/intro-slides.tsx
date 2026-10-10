"use client"

// #377 (behind `introV2`): the intro slides a signed-out visitor sees on
// this device's first open of the home map. Three slides: what sponti is, why
// it exists, how lighting a flare works. Each slide is an animated scene
// (`intro-scenes.tsx`) above its copy, progress dots and a full-width button.
//
// The whole screen is the dusk ink (`INTRO_INK`) in light and dark mode
// alike, and the scenes fade into it at their edges, so nothing sits under
// the type. Type is warm white, the logo badge and skip are frosted glass,
// and the peach button is the only accent.
//
// Motion: one entrance (the scene settles in, the copy block rises once).
// Each scene plays its story from the start when its slide comes on. The
// scenes follow a finger and slide between slides, the copy crossfades with a
// small drift, the dots stretch, the button's label swaps in place and skip
// fades out on the last slide. Under prefers-reduced-motion nothing moves and
// slides cut.
//
// "look around" (the last slide), skip and Escape go to the map; "i have an
// account" goes to /login. Leaving any way marks the slides seen (see
// `lib/intro-slides.ts`). Swipe, the dots and the arrow keys move between
// slides.
//
// Loaded lazily by `intro-slides-gate.tsx`, so this file and its styles ship
// only to a visitor who is about to see them.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, FlameIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { IntroScene, INTRO_SCENE_CSS } from "@/components/intro-scenes"
import { haptic } from "@/lib/haptics"
import { INTRO_INK } from "@/lib/intro-slides"
import { cn } from "@/lib/utils"

export type Kind = "what" | "why" | "how"

const SLIDES: readonly Kind[] = ["what", "why", "how"]

const SWIPE_MIN_PX = 48

/** The WHO report the landing page cites. */
export const WHO_REPORT_URL =
  "https://www.who.int/publications/i/item/978240112360"

// ---- copy --------------------------------------------------------------------

export const INTRO_COPY: Record<
  Kind,
  { eyebrow: string; title: string; body: string }
> = {
  what: {
    eyebrow: "what sponti is",
    title: "plans with friends, right now or soon.",
    body: "skip the endless back and forth. share what you're up for and let your people join in.",
  },
  why: {
    eyebrow: "why it exists",
    title: "more connected than ever, yet still missing each other.",
    body: 'messages everywhere, but making time for your favourite people still takes effort. sponti helps turn "we should" into actually seeing each other.',
  },
  how: {
    eyebrow: "how it works",
    title: "light a flare.",
    body: "drinks after work, ping-pong in the park, a walk with no plan. let your people know what you're up to, so they can join.",
  },
}

// ---- motion ------------------------------------------------------------------

/** Settles fast and gently, like a card coming to rest. */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"

/** How far, in px, the copy drifts while it hands over to the next slide. */
const COPY_DRIFT_PX = 28

/** A drag past the first or last slide pulls back at this fraction. */
const EDGE_RESISTANCE = 0.25

const MOTION =
  "transition-[transform,opacity] duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"

// ---- screens -----------------------------------------------------------------

export function IntroSlides({ onLeave }: { onLeave: () => void }) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  /** How many times each slide has come on screen: its scene's key, so the
   * scene starts its story over each time. */
  const [visits, setVisits] = useState(() => SLIDES.map((_, i) => +(i === 0)))
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const kind = SLIDES[index]
  const last = index === SLIDES.length - 1

  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), SLIDES.length - 1)
    if (clamped === index) return
    haptic("selection")
    setIndex(clamped)
    setVisits((v) => v.map((n, i) => (i === clamped ? n + 1 : n)))
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

  const onTouchMove = (event: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = event.touches[0].clientX - touchX.current
    const pastEdge = (dx > 0 && index === 0) || (dx < 0 && last)
    setDrag(pastEdge ? dx * EDGE_RESISTANCE : dx)
  }

  const endTouch = (event: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = event.changedTouches[0].clientX - touchX.current
    touchX.current = null
    setDrag(0)
    if (dx <= -SWIPE_MIN_PX) go(index + 1)
    else if (dx >= SWIPE_MIN_PX) go(index - 1)
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
      onTouchMove={onTouchMove}
      onTouchEnd={endTouch}
      onTouchCancel={() => {
        touchX.current = null
        setDrag(0)
      }}
      className="intro-slides fixed inset-0 isolate z-[55] flex touch-pan-y flex-col overflow-hidden text-white outline-none select-none"
      style={{ backgroundColor: INTRO_INK }}
    >
      <IntroStyles />

      <header className="intro-fade relative shrink-0 px-6 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-accent ring-1 ring-white/25 backdrop-blur-md">
              <FlameIcon className="size-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              sponti
            </span>
          </div>
          <button
            type="button"
            onClick={lookAround}
            aria-hidden={last || undefined}
            tabIndex={last ? -1 : undefined}
            inert={last}
            className={cn(
              "relative h-9 rounded-full bg-white/15 px-4 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-md transition-[opacity,background-color] duration-300 after:absolute after:-inset-2 hover:bg-white/25 motion-reduce:transition-none",
              FOCUS_RING,
              last && "pointer-events-none opacity-0"
            )}
          >
            skip
          </button>
        </div>
      </header>

      <Stage index={index} drag={drag} visits={visits} />

      <div className="intro-rise relative flex flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Copy index={index} drag={drag} />

        <Dots index={index} onPick={go} />

        <div className="mt-4 flex flex-col gap-1">
          <Button
            type="button"
            onClick={last ? lookAround : () => go(index + 1)}
            className={cn(
              "h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-foreground transition-[transform,background-color] hover:bg-accent/90 active:scale-[0.98] motion-reduce:transition-none",
              FOCUS_RING
            )}
          >
            <span
              key={last ? "enter" : "next"}
              className="intro-label inline-flex items-center gap-2"
            >
              {last ? "look around" : "next"}
              <ArrowRightIcon className="size-4" />
            </span>
          </Button>
          <button
            type="button"
            onClick={signIn}
            className={cn(
              "min-h-11 w-full rounded-full text-sm font-medium text-white/80 transition-colors hover:text-white motion-reduce:transition-none",
              FOCUS_RING
            )}
          >
            i have an account
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** The three slides' copy, stacked in one grid cell. The one on screen settles
 * in; the others wait a short drift to the side, faded out. The cell takes the
 * height of the tallest and the copy sits on its floor, so the controls never
 * jump. Only the one on screen is in the accessibility tree. */
function Copy({ index, drag }: { index: number; drag: number }) {
  return (
    <div className="grid items-end" aria-live="polite">
      {SLIDES.map((kind, i) => {
        const copy = INTRO_COPY[kind]
        const active = i === index
        const offset = Math.sign(i - index) * COPY_DRIFT_PX
        const x = active ? drag * 0.3 : offset
        return (
          <div
            key={kind}
            aria-hidden={!active || undefined}
            inert={!active}
            className={cn(
              "col-start-1 row-start-1",
              MOTION,
              active ? "opacity-100" : "opacity-0",
              // Dragging follows the finger with no easing at all.
              drag !== 0 && "!transition-none"
            )}
            style={{
              transform: `translate3d(${x}px, 0, 0)`,
              // The one leaving goes first, the one arriving follows it.
              transitionDelay: active ? "140ms" : "0ms",
            }}
          >
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              {copy.eyebrow}
            </p>
            <h1 className="intro-title mt-3 text-3xl leading-[1.1] font-semibold tracking-tight text-balance">
              {copy.title}
            </h1>
            <p className="intro-body mt-3 text-base leading-snug text-white/85">
              {copy.body}
            </p>
          </div>
        )
      })}
    </div>
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
      className="mt-5 flex items-center gap-0.5"
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
          className={cn(
            "flex h-6 items-center rounded-full px-0.5",
            FOCUS_RING
          )}
        >
          <span
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              i === index ? "w-7 bg-white" : "w-1.5 bg-white/40"
            )}
          />
        </button>
      ))}
    </div>
  )
}

// ---- the art -----------------------------------------------------------------

/** The three scenes, between the header and the copy. They slide with the
 * finger and settle with the same ease as the copy. Only the one on screen
 * plays. Decorative: the copy says the same, so it is hidden from readers. */
function Stage({
  index,
  drag,
  visits,
}: {
  index: number
  drag: number
  visits: number[]
}) {
  return (
    <div
      className="intro-reveal pointer-events-none relative -z-10 min-h-0 flex-1"
      aria-hidden
    >
      {SLIDES.map((kind, i) => (
        <div
          key={kind}
          className={cn(
            "absolute inset-0 py-2 will-change-transform",
            MOTION,
            drag !== 0 && "!transition-none"
          )}
          style={{
            transform: `translate3d(calc(${(i - index) * 100}% + ${drag}px), 0, 0)`,
          }}
        >
          <IntroScene key={visits[i]} kind={kind} active={i === index} />
        </div>
      ))}
    </div>
  )
}

// ---- motion --------------------------------------------------------------------

/** Slow and calm. Inline, so the styles ship in this lazy chunk and not in
 * the app's global css. */
export function IntroStyles() {
  return (
    <style>{`
      ${INTRO_SCENE_CSS}

      /* The one entrance: the scene settles in, then the copy block rises once. */
      .intro-reveal { animation: intro-reveal 1100ms ${EASE} both; }
      @keyframes intro-reveal { from { opacity: 0; transform: scale(1.06); } to { opacity: 1; transform: none; } }
      .intro-fade { animation: intro-fade 700ms ease-out 300ms both; }
      @keyframes intro-fade { from { opacity: 0; } to { opacity: 1; } }
      .intro-rise { animation: intro-rise 800ms ${EASE} 400ms both; }
      @keyframes intro-rise { from { opacity: 0; transform: translate3d(0, 20px, 0); } to { opacity: 1; transform: none; } }

      /* The button's label swapping from "next" to "look around". */
      .intro-label { animation: intro-label 320ms ease-out both; }
      @keyframes intro-label { from { opacity: 0; transform: translate3d(0, 6px, 0); } to { opacity: 1; transform: none; } }

      /* Short phones: the copy gives up a size so the scene keeps room. */
      @media (max-height: 700px) {
        .intro-title { font-size: 1.5rem; }
        .intro-body { font-size: 0.875rem; }
      }

      @media (prefers-reduced-motion: reduce) {
        .intro-reveal, .intro-fade, .intro-rise, .intro-label { animation: none; }
      }
    `}</style>
  )
}
