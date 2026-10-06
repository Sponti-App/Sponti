"use client"

// #379 (behind `coachMarks`, flare moments #370): the coach marks on the
// signed-out map. The screen dims except one thing, with a card beside it:
// "n of 3", a title, one line, skip and next ("got it" on the last). Set A
// from the intro prototype (#373, PR #407 section 2): the idea spot, the
// flare button, then the map/calendar toggle. With no idea spot on screen
// (none near, or ideas hidden) that mark is left out: "n of 2".
//
// The overlay takes every tap, so nothing under it opens while it shows.
// `SignedOutHome` mounts it only when no slide or sheet is up, and holds the
// location ask until it's done.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import {
  coachMarkSteps,
  firstBoxInside,
  type Box,
  type CoachMark,
  type CoachMarkId,
} from "@/lib/coach-marks"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

/** What each mark points at. The view toggle carries `data-coach`. */
const TARGETS: Record<Exclude<CoachMarkId, "idea">, string> = {
  flare: 'nav[aria-label="Primary"] [data-nav-flare-circle]',
  calendar: '[data-coach="view-toggle"]',
}

// How long to wait for an idea spot to render (the map's clock, Google's
// markers) before running without it.
const IDEA_WAIT_MS = 1500
const IDEA_POLL_MS = 100
// Clear of the header chips and the area chip under them.
const HEADER_CLEARANCE = 112
const PAD = 8

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  )
}

/** The first idea spot the visitor can see, between the header and the dock. */
function findIdeaOnScreen(): string | null {
  const pins = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-signed-out-map] [data-idea-pin]"
    )
  )
  if (pins.length === 0) return null
  const dock = document.querySelector("[data-map-dock]")
  const dockTop = dock?.getBoundingClientRect().top ?? window.innerHeight
  const index = firstBoxInside(pins.map(boxOf), {
    top: HEADER_CLEARANCE,
    bottom: Math.min(dockTop, window.innerHeight),
    left: 0,
    right: window.innerWidth,
  })
  return index === null ? null : (pins[index].dataset.ideaPin ?? null)
}

function selectorFor(mark: CoachMarkId, ideaId: string | null): string | null {
  if (mark === "idea") {
    return ideaId ? `[data-idea-pin="${CSS.escape(ideaId)}"]` : null
  }
  return TARGETS[mark]
}

/** The spotlight around a target: a circle for a round one, else a pill. */
function spotlight(target: Box): Box & { round: boolean } {
  const round = Math.abs(target.width - target.height) < 24
  if (round) {
    const size = Math.max(target.width, target.height) + PAD * 2
    return {
      top: target.top + target.height / 2 - size / 2,
      left: target.left + target.width / 2 - size / 2,
      width: size,
      height: size,
      round,
    }
  }
  return {
    top: target.top - PAD,
    left: target.left - PAD,
    width: target.width + PAD * 2,
    height: target.height + PAD * 2,
    round,
  }
}

export function CoachMarks({ onDone }: { onDone: () => void }) {
  // Null while looking for an idea spot; then the marks to run.
  const [plan, setPlan] = useState<{
    steps: CoachMark[]
    ideaId: string | null
  } | null>(null)
  const [index, setIndex] = useState(0)
  const [target, setTarget] = useState<Box | null>(null)
  const [viewport, setViewport] = useState({ height: 0 })

  useEffect(() => {
    // Counted, not timed: a frozen clock (tests, a paused tab) still ends it.
    let polls = 0
    const timer = window.setInterval(() => {
      polls += 1
      const ideaId = findIdeaOnScreen()
      if (ideaId || polls * IDEA_POLL_MS >= IDEA_WAIT_MS) {
        window.clearInterval(timer)
        setPlan({ steps: coachMarkSteps(ideaId !== null), ideaId })
      }
    }, IDEA_POLL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const mark = plan?.steps[index] ?? null
  const selector = mark ? selectorFor(mark.id, plan?.ideaId ?? null) : null

  // Follows the target every frame: idea spots move when the pins around
  // them load, Google's markers settle late, and the nav publishes its
  // height after mount. One rect read a frame; state only changes on a move.
  useLayoutEffect(() => {
    if (!selector) return
    let frame = 0
    const measure = () => {
      const el = document.querySelector(selector)
      const next = el ? boxOf(el) : null
      setTarget((prev) => (sameBox(prev, next) ? prev : next))
      const height = window.innerHeight
      setViewport((prev) => (prev.height === height ? prev : { height }))
      frame = window.requestAnimationFrame(measure)
    }
    measure()
    return () => window.cancelAnimationFrame(frame)
  }, [selector])

  // Each mark's card takes focus, not "next": a focused button would get the
  // peach focus ring beside the peach flare button.
  const cardRef = useRef<HTMLDivElement>(null)
  const markId = mark?.id
  useEffect(() => {
    if (markId) cardRef.current?.focus({ preventScroll: true })
  }, [markId])

  const finish = useCallback(() => {
    haptic("selection")
    onDone()
  }, [onDone])

  const next = () => {
    if (!plan) return
    if (index >= plan.steps.length - 1) return finish()
    haptic("selection")
    setIndex(index + 1)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [finish])

  if (!plan || !mark) return null

  const count = plan.steps.length
  const last = index === count - 1
  const spot = target ? spotlight(target) : null
  // The card goes on the far side of the spotlight's half of the screen.
  const below = spot ? spot.top + spot.height / 2 < viewport.height / 2 : true
  const titleId = `coach-mark-${mark.id}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-coach-mark={mark.id}
      className="fixed inset-0 z-[45]"
    >
      {spot ? (
        <div
          aria-hidden="true"
          data-coach-spotlight
          className={cn(
            "pointer-events-none absolute transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            spot.round ? "rounded-full" : "rounded-2xl"
          )}
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 200vmax oklch(0.15 0.02 266 / 0.62)",
          }}
        >
          <span
            className={cn(
              "animate-coach-ring absolute inset-0",
              spot.round ? "rounded-full" : "rounded-2xl"
            )}
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[oklch(0.15_0.02_266/0.62)]"
        />
      )}

      <div
        key={mark.id}
        ref={cardRef}
        tabIndex={-1}
        className="absolute inset-x-4 animate-in rounded-2xl bg-card p-4 text-card-foreground shadow-xl duration-300 outline-none fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
        style={
          spot
            ? below
              ? { top: spot.top + spot.height + 12 }
              : { bottom: viewport.height - spot.top + 12 }
            : { top: "40%" }
        }
      >
        <p className="text-xs text-muted-foreground">
          {index + 1} of {count}
        </p>
        <p id={titleId} className="mt-1 text-base font-semibold">
          {mark.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{mark.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={finish}
            className="min-h-11 text-sm font-medium text-muted-foreground"
          >
            skip
          </button>
          {/* Not peach: the flare button is the peach on this screen. */}
          <Button
            type="button"
            onClick={next}
            className="h-10 rounded-full bg-foreground px-5 text-sm text-background hover:bg-foreground/90"
          >
            {last ? "got it" : "next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
