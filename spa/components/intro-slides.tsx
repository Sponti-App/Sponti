"use client"

// #377 (behind `introV2`): the intro slides a signed-out visitor sees on
// this device's first open of the home map. Three slides: what sponti is, why
// it exists, how lighting a flare works. Each slide is a full-bleed
// illustration (`public/intro/*.jpg`) that fades into the page under the
// copy, a large quiet title, a full-width pill button and tappable progress
// dots.
//
// "look around" (the last slide), skip and Escape go to the map; "i have an
// account" goes to /login. Leaving any way marks the slides seen (see
// `lib/intro-slides.ts`). Swipe, the dots and the arrow keys move between
// slides. Under prefers-reduced-motion nothing moves.
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
        <div key={kind} className="intro-in" aria-live="polite">
          <p className="text-sm font-medium text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-medium tracking-tight text-balance">
            {copy.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{copy.body}</p>
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

// ---- the art -----------------------------------------------------------------

/** The slide's illustration, full-bleed, with a fade into the page under the
 * copy. The image is decorative, so it has no alt text. */
export function Backdrop({ kind }: { kind: Kind }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <Image
        src={`/intro/${kind}.jpg`}
        alt=""
        fill
        sizes="100vw"
        className="intro-art object-cover object-top"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background:
            "linear-gradient(to top, var(--background) 45%, color-mix(in oklch, var(--background) 70%, transparent) 75%, transparent)",
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
      .intro-in { animation: intro-in 280ms cubic-bezier(0.32, 0.72, 0, 1); }
      @keyframes intro-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

      .intro-art { animation: intro-art 18s ease-in-out infinite alternate; transform-origin: 50% 40%; }
      @keyframes intro-art { from { transform: scale(1); } to { transform: scale(1.04); } }

      @media (prefers-reduced-motion: reduce) {
        .intro-in, .intro-art { animation: none; }
      }
    `}</style>
  )
}
