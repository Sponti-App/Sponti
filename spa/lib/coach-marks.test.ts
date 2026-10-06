import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  COACH_MARKS_KEY,
  coachMarkSteps,
  coachMarksVisible,
  firstBoxInside,
  markCoachMarksSeen,
  resetCoachMarks,
  resetCoachMarksMemory,
  shouldShowCoachMarks,
} from "./coach-marks"
import { INTRO_SLIDES_KEY } from "./intro-slides"
import {
  NEW_ONBOARDING_KEY,
  resetNewOnboardingMemory,
} from "./onboarding-flags"

// #379: the coach marks show once per device on the signed-out map, after
// the intro slides and before the location ask, only with `coachMarks` on
// (the full profile).

const mocks = vi.hoisted(() => ({ flags: { coachMarks: true } }))

vi.mock("@/lib/feature-flags", () => ({ featureFlags: mocks.flags }))

beforeEach(() => {
  mocks.flags.coachMarks = true
  window.localStorage.clear()
  resetCoachMarksMemory()
  resetNewOnboardingMemory()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("coach marks seen state (#379)", () => {
  it("shows on a device that hasn't seen them", () => {
    expect(shouldShowCoachMarks()).toBe(true)
  })

  it("stops showing once they're finished or skipped", () => {
    markCoachMarksSeen()

    expect(shouldShowCoachMarks()).toBe(false)
    expect(window.localStorage.getItem(COACH_MARKS_KEY)).toBe("seen")
  })

  it("stays seen after a reload", () => {
    markCoachMarksSeen()
    resetCoachMarksMemory()

    expect(shouldShowCoachMarks()).toBe(false)
  })

  it("ignores anything else stored under the key", () => {
    window.localStorage.setItem(COACH_MARKS_KEY, "nonsense")

    expect(shouldShowCoachMarks()).toBe(true)
  })

  it("is separate from the intro slides' state", () => {
    window.localStorage.setItem(INTRO_SLIDES_KEY, "seen")
    expect(shouldShowCoachMarks()).toBe(true)

    window.localStorage.removeItem(INTRO_SLIDES_KEY)
    markCoachMarksSeen()
    expect(window.localStorage.getItem(INTRO_SLIDES_KEY)).toBeNull()
  })

  it("still shows once for the session when storage throws", () => {
    const boom = () => {
      throw new Error("SecurityError")
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom)

    expect(shouldShowCoachMarks()).toBe(true)
    expect(() => markCoachMarksSeen()).not.toThrow()
    expect(shouldShowCoachMarks()).toBe(false)
  })

  it("never shows with coachMarks off (the tester build)", () => {
    mocks.flags.coachMarks = false

    expect(shouldShowCoachMarks()).toBe(false)
  })

  it("shows in the tester build when the device's new onboarding switch is on (#482)", () => {
    mocks.flags.coachMarks = false
    window.localStorage.setItem(NEW_ONBOARDING_KEY, "on")

    expect(shouldShowCoachMarks()).toBe(true)
  })

  it("shows again after settings replays them (#482)", () => {
    markCoachMarksSeen()
    expect(shouldShowCoachMarks()).toBe(false)

    resetCoachMarks()

    expect(shouldShowCoachMarks()).toBe(true)
    expect(window.localStorage.getItem(COACH_MARKS_KEY)).toBeNull()
  })
})

describe("which marks run", () => {
  it("runs set A in order: idea spot, flare button, map/calendar toggle", () => {
    expect(coachMarkSteps(true).map((m) => m.id)).toEqual([
      "idea",
      "flare",
      "calendar",
    ])
    expect(coachMarkSteps(true).map((m) => m.title)).toEqual([
      "ideas nearby",
      "light a flare",
      "soon lives here",
    ])
  })

  it("leaves the idea spot out when none is on screen", () => {
    expect(coachMarkSteps(false).map((m) => m.id)).toEqual([
      "flare",
      "calendar",
    ])
  })

  it("keeps all copy lowercase", () => {
    for (const mark of coachMarkSteps(true)) {
      expect(mark.title).toBe(mark.title.toLowerCase())
      expect(mark.body).toBe(mark.body.toLowerCase())
    }
  })
})

describe("when the marks show", () => {
  const base = {
    pending: true,
    slidesShowing: false,
    sheetOpen: false,
    onMap: true,
  }

  it("shows on the map once the slides are gone", () => {
    expect(coachMarksVisible(base)).toBe(true)
  })

  it("never covers the intro slides", () => {
    expect(coachMarksVisible({ ...base, slidesShowing: true })).toBe(false)
  })

  it("never covers an open sheet (the sign-up sheet)", () => {
    expect(coachMarksVisible({ ...base, sheetOpen: true })).toBe(false)
  })

  it("only runs on the map, not the calendar", () => {
    expect(coachMarksVisible({ ...base, onMap: false })).toBe(false)
  })

  it("doesn't show once seen", () => {
    expect(coachMarksVisible({ ...base, pending: false })).toBe(false)
  })
})

describe("finding an idea spot on screen", () => {
  const area = { top: 112, bottom: 600, left: 0, right: 390 }
  const box = (top: number, left: number) => ({
    top,
    left,
    width: 44,
    height: 44,
  })

  it("picks the first spot wholly inside the area", () => {
    expect(firstBoxInside([box(200, 100), box(300, 100)], area)).toBe(0)
  })

  it("skips spots under the header, under the dock or off the sides", () => {
    expect(
      firstBoxInside(
        [
          box(90, 100),
          box(580, 100),
          box(200, -10),
          box(200, 370),
          box(400, 60),
        ],
        area
      )
    ).toBe(4)
  })

  it("is null when none is on screen", () => {
    expect(firstBoxInside([], area)).toBeNull()
    expect(firstBoxInside([box(700, 100)], area)).toBeNull()
  })

  it("ignores a spot that isn't laid out", () => {
    expect(
      firstBoxInside([{ top: 200, left: 100, width: 0, height: 0 }], area)
    ).toBeNull()
  })
})
