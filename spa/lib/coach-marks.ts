"use client"

import { useSyncExternalStore } from "react"
import { getOnboardingFlags, useOnboardingFlags } from "@/lib/onboarding-flags"

// #379 (behind `coachMarks`, flare moments #370): up to three coach marks on
// the signed-out map, once per device. They run after the intro slides (#377)
// and before the location ask (#408), which waits for them. Set A from the
// intro prototype (#373, PR #407 section 2): the idea spot, the flare button,
// then the map/calendar toggle. Settings can replay them (#482).
//
// Storage follows `intro-slides.ts`: one device-only localStorage key, every
// call wrapped (private windows, blocked site data), and `memory` carrying the
// state for the session when storage throws. Skip, "got it" and Escape all
// mark them seen. Leaving the page mid-way doesn't, so a reload shows them
// again from the start.

export const COACH_MARKS_KEY = "sponti.coach-marks.v1"

const SEEN = "seen"

let memory: boolean | undefined
const listeners = new Set<() => void>()

function readSeen(): boolean {
  if (memory !== undefined) return memory
  try {
    return window.localStorage.getItem(COACH_MARKS_KEY) === SEEN
  } catch {
    return false
  }
}

/** The marks were finished or skipped: don't show them again on this device. */
export function markCoachMarksSeen(): void {
  memory = true
  try {
    window.localStorage.setItem(COACH_MARKS_KEY, SEEN)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

/** #482: forget that the marks were seen, so this device sees them again. */
export function resetCoachMarks(): void {
  memory = false
  try {
    window.localStorage.removeItem(COACH_MARKS_KEY)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

/** With `coachMarks` on, whether this device still has to see the marks. */
export function shouldShowCoachMarks(): boolean {
  return getOnboardingFlags().coachMarks && !readSeen()
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== COACH_MARKS_KEY) return
    memory = undefined
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/**
 * True while the marks are still owed on this device: they may be waiting
 * for the slides or a sheet, or showing. The location ask holds while it is.
 */
export function useCoachMarksPending(): boolean {
  const { coachMarks } = useOnboardingFlags()
  const unseen = useSyncExternalStore(
    subscribe,
    () => !readSeen(),
    () => false
  )
  return coachMarks && unseen
}

/** Test seam: forget the in-memory state so storage is read again. */
export function resetCoachMarksMemory(): void {
  memory = undefined
}

// ---- the marks -------------------------------------------------------------

export type CoachMarkId = "idea" | "flare" | "calendar"

export type CoachMark = { id: CoachMarkId; title: string; body: string }

/** Set A, in order. Copy from the prototype. The idea spot's body drops the
 * prototype's "no flares around yet?", since open-to-all flares (#425) can be
 * on the map too. */
export const COACH_MARKS: readonly CoachMark[] = [
  {
    id: "idea",
    title: "ideas nearby",
    body: "the dashed spots are ideas. tap one to make it your flare.",
  },
  {
    id: "flare",
    title: "light a flare",
    body: "say what you're up to, right now or at a time you pick.",
  },
  {
    id: "calendar",
    title: "soon lives here",
    body: "the map shows what's on now. flares with a picked time wait in the calendar.",
  },
]

/** The marks to run: without the idea spot when none is on screen ("n of 2"). */
export function coachMarkSteps(ideaSpotOnScreen: boolean): CoachMark[] {
  return COACH_MARKS.filter((mark) => ideaSpotOnScreen || mark.id !== "idea")
}

/**
 * Whether the marks show right now. They never cover the intro slides, the
 * sign-up sheet or any other open sheet, and only run on the map view.
 */
export function coachMarksVisible({
  pending,
  slidesShowing,
  sheetOpen,
  onMap,
}: {
  pending: boolean
  slidesShowing: boolean
  sheetOpen: boolean
  onMap: boolean
}): boolean {
  return pending && !slidesShowing && !sheetOpen && onMap
}

export type Box = { top: number; left: number; width: number; height: number }

/**
 * The index of the first box that sits wholly inside `area`: an idea spot the visitor can actually see, not one under the
 * header chips or the dock. Null when there is none.
 */
export function firstBoxInside(
  boxes: readonly Box[],
  area: { top: number; bottom: number; left: number; right: number }
): number | null {
  const index = boxes.findIndex(
    (b) =>
      b.width > 0 &&
      b.height > 0 &&
      b.top >= area.top &&
      b.top + b.height <= area.bottom &&
      b.left >= area.left &&
      b.left + b.width <= area.right
  )
  return index === -1 ? null : index
}
