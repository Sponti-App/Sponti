"use client"

// #377 (behind `introV2`): the intro slides a signed-out visitor sees on
// this device's first open of the home map. Three slides: what sponti is, why
// it exists, how lighting a flare works. Each slide is a full-bleed
// illustration (`public/intro/*.jpg`) with a large quiet title, a full-width
// pill button and tappable progress dots. The art and the copy slide sideways
// between slides, and the copy sits on pills so it reads over the art.
//
// "look around" (the last slide), skip and Escape go to the map; "i have an
// account" goes to /login. Leaving any way marks the slides seen (see
// `lib/intro-slides.ts`). Swipe, the dots and the arrow keys move between
// slides. Under prefers-reduced-motion nothing moves and slides cut.
//
// Loaded lazily by `intro-slides-gate.tsx`, so this file and its styles ship
// only to a visitor who is about to see them.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, FlameIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
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

/** Where slide `offset` sits, in slides, from the one on screen. */
const slideX = (offset: number) => `translate3d(${offset * 100}%, 0, 0)`

/** The slides' motion: a slide moves across in half a second, and slower
 * drifts are the art's own. Off under prefers-reduced-motion. */
const SLIDE_MOTION =
  "transition-transform duration-500 ease-out motion-reduce:transition-none"

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
      <Backdrop index={index} />

      <header className="relative flex items-center justify-between px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 rounded-full bg-background/80 py-1 pr-3 pl-1 shadow-sm backdrop-blur-md">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
            <FlameIcon className="size-3.5" />
          </span>
          <span className="text-sm font-semibold">sponti</span>
        </div>
        {!last && (
          <button
            type="button"
            onClick={lookAround}
            className="min-h-10 rounded-full bg-background/80 px-4 text-sm font-medium text-foreground shadow-sm backdrop-blur-md hover:bg-background"
          >
            skip
          </button>
        )}
      </header>

      <div className="relative mt-auto flex flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Copy index={index} />

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

/** The three slides' copy, stacked in one grid cell and slid sideways. The
 * cell takes the height of the tallest, so the controls below never jump.
 * Only the one on screen is in the accessibility tree. */
function Copy({ index }: { index: number }) {
  return (
    <div className="grid overflow-hidden" aria-live="polite">
      {SLIDES.map((kind, i) => {
        const copy = INTRO_COPY[kind]
        const active = i === index
        return (
          <div
            key={kind}
            aria-hidden={!active || undefined}
            inert={!active}
            className={cn("col-start-1 row-start-1", SLIDE_MOTION)}
            style={{ transform: slideX(i - index) }}
          >
            <p className="inline-flex rounded-full bg-background/80 px-3 py-1 text-sm font-medium text-foreground shadow-sm backdrop-blur-md">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl leading-tight font-medium tracking-tight text-balance">
              {copy.title}
            </h1>
            <p className="mt-3 text-base text-muted-foreground">{copy.body}</p>
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

// ---- the art -----------------------------------------------------------------

/** The three illustrations, full-bleed in the top part of the screen, so the
 * motif sits high and clear. The bottom of each fades into the page under the
 * copy. The art is decorative, so it has no alt text. */
export function Backdrop({ index }: { index: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {SLIDES.map((kind, i) => (
        <div
          key={kind}
          className={cn(
            "absolute inset-x-0 top-0 h-[78%] [mask-image:linear-gradient(to_bottom,black_72%,transparent)]",
            SLIDE_MOTION
          )}
          style={{ transform: slideX(i - index) }}
        >
          <Image
            src={`/intro/${kind}.jpg`}
            alt=""
            fill
            sizes="100vw"
            priority={i === 0}
            className="intro-art object-cover object-top"
          />
        </div>
      ))}
      <div
        className="absolute inset-x-0 bottom-0 h-[45%]"
        style={{
          background:
            "linear-gradient(to top, var(--background) 30%, color-mix(in oklch, var(--background) 60%, transparent) 65%, transparent)",
        }}
      />
    </div>
  )
}

// ---- motion --------------------------------------------------------------------

/** Slow and calm. Inline, so the styles ship in this lazy chunk and not in
 * the app's global css. */
export function IntroStyles() {
  return (
    <style>{`
      .intro-art { animation: intro-art 18s ease-in-out infinite alternate; transform-origin: 50% 40%; }
      @keyframes intro-art { from { transform: scale(1); } to { transform: scale(1.04); } }

      @media (prefers-reduced-motion: reduce) {
        .intro-art { animation: none; }
      }
    `}</style>
  )
}
