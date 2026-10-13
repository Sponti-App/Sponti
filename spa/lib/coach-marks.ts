"use client"

import { useSyncExternalStore } from "react"
import { getOnboardingFlags, useOnboardingFlags } from "@/lib/onboarding-flags"

// #560 (behind `coachMarks`, flare moments #370): the coach marks run once
// per device, on the signed-in home map only. They used to be two runs, three
// marks on the signed-out map (#379) and the circles tab and menu after
// sign-in (#497), which read as one tour cut in half. Now a signed-out visitor
// gets the intro slides and the map with no marks, and all five marks wait for
// an account: the idea spot, the flare button, the now/soon toggle, the
// circles tab, then the menu (Patrick lifted #379's limit of three). Settings
// can replay them (#482).
//
// Storage follows `intro-slides.ts`: one device-only localStorage key, every
// call wrapped (private windows, blocked site data), and `memory` carrying the
// state for the session when storage throws. Skip, "got it" and Escape all
// mark them seen. Leaving the page mid-way doesn't, so a reload shows them
// again from the start.

/** A new key on purpose: a device that saw either old run (`coach-marks.v1`,
 * `coach-marks.home.v1`) only saw part of the tour, so it sees the whole run
 * once. */
export const COACH_MARKS_KEY = "sponti.coach-marks.v2"

const SEEN = "seen"

let memory: boolean | undefined
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function readSeen(): boolean {
  if (memory !== undefined) return memory
  try {
    return window.localStorage.getItem(COACH_MARKS_KEY) === SEEN
  } catch {
    return false
  }
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

/** The marks were finished or skipped: don't show them again on this device. */
export function markCoachMarksSeen(): void {
  memory = true
  try {
    window.localStorage.setItem(COACH_MARKS_KEY, SEEN)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  notify()
}

/** #482: forget that the marks were seen, so this device sees them again. */
export function resetCoachMarks(): void {
  memory = false
  try {
    window.localStorage.removeItem(COACH_MARKS_KEY)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  notify()
}

/** With `coachMarks` on, whether this device still has to see the marks. */
export function shouldShowCoachMarks(): boolean {
  return getOnboardingFlags().coachMarks && !readSeen()
}

/**
 * True while the marks are still owed on this device: they may be waiting
 * for the checklist or a sheet, or showing.
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

export type CoachMarkId = "idea" | "flare" | "calendar" | "circles" | "menu"

export type CoachMark = { id: CoachMarkId; title: string; body: string }

/** In order. The first three are set A from the intro prototype (#373); the
 * idea spot's body drops the prototype's "no flares around yet?", since
 * open-to-all flares (#425) can be on the map too. */
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
    body: "now is what's on around you. flares with a picked time wait under soon.",
  },
  {
    id: "circles",
    title: "your circles",
    body: "friends and circles live here, and it's where you add people.",
  },
  {
    id: "menu",
    title: "menu",
    body: "your profile and settings are in here.",
  },
]

/** The marks to run: without the idea spot when none is on screen ("n of 4"). */
export function coachMarkSteps(ideaSpotOnScreen: boolean): CoachMark[] {
  return COACH_MARKS.filter((mark) => ideaSpotOnScreen || mark.id !== "idea")
}

/**
 * Whether the marks show right now. Never over the post-sign-up checklist or
 * first-friend step (#459), the first-run intro, a detail sheet, the menu or
 * any open dialog, and only on the map view.
 */
export function coachMarksVisible({
  pending,
  onboardingShowing,
  blocked,
  dialogOpen,
}: {
  pending: boolean
  /** The checklist, the first-run intro or the first-friend step is up. */
  onboardingShowing: boolean
  /** The home's own state: menu, invite, flare detail, a dock card, or the
   * calendar view. */
  blocked: boolean
  /** Any other open dialog or sheet in the document. */
  dialogOpen: boolean
}): boolean {
  return pending && !onboardingShowing && !blocked && !dialogOpen
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
