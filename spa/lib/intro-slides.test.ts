import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  INTRO_SLIDES_KEY,
  markIntroSlidesSeen,
  resetIntroSlides,
  resetIntroSlidesMemory,
  shouldShowIntroSlides,
} from "./intro-slides"
import { resetNewOnboardingMemory } from "./onboarding-flags"

// #377: the intro slides show once per device on a signed-out visitor's
// first open, and only with `introV2` on (the full profile).

const mocks = vi.hoisted(() => ({
  flags: { introV2: true, browseBeforeSignup: false, locationAsk: false },
}))

vi.mock("@/lib/feature-flags", () => ({ featureFlags: mocks.flags }))

beforeEach(() => {
  mocks.flags.introV2 = true
  window.localStorage.clear()
  resetNewOnboardingMemory()
  resetIntroSlidesMemory()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("intro slides seen state (#377)", () => {
  it("shows on a device that hasn't seen them", () => {
    expect(shouldShowIntroSlides()).toBe(true)
  })

  it("stops showing once they've been left", () => {
    markIntroSlidesSeen()

    expect(shouldShowIntroSlides()).toBe(false)
    expect(window.localStorage.getItem(INTRO_SLIDES_KEY)).toBe("seen")
  })

  it("stays seen after a reload", () => {
    markIntroSlidesSeen()
    resetIntroSlidesMemory()

    expect(shouldShowIntroSlides()).toBe(false)
  })

  it("ignores anything else stored under the key", () => {
    window.localStorage.setItem(INTRO_SLIDES_KEY, "nonsense")

    expect(shouldShowIntroSlides()).toBe(true)
  })

  it("doesn't touch the post-sign-up intro's state", () => {
    markIntroSlidesSeen()

    expect(window.localStorage.getItem("sponti.onboarding.v1")).toBeNull()
  })

  it("still shows once for the session when storage throws", () => {
    const boom = () => {
      throw new Error("SecurityError")
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom)

    expect(shouldShowIntroSlides()).toBe(true)
    expect(() => markIntroSlidesSeen()).not.toThrow()
    expect(shouldShowIntroSlides()).toBe(false)
  })
})

describe("replaying the intro slides (#482)", () => {
  it("shows them again on a device that saw them", () => {
    markIntroSlidesSeen()

    resetIntroSlides()

    expect(shouldShowIntroSlides()).toBe(true)
    expect(window.localStorage.getItem(INTRO_SLIDES_KEY)).toBeNull()
  })

  it("still shows them again for the session when storage throws", () => {
    markIntroSlidesSeen()
    const boom = () => {
      throw new Error("SecurityError")
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom)
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom)

    expect(() => resetIntroSlides()).not.toThrow()
    expect(shouldShowIntroSlides()).toBe(true)
  })
})

describe("intro slides with introV2 off (the tester build)", () => {
  it("never shows, even on a device that hasn't seen them", () => {
    mocks.flags.introV2 = false

    expect(shouldShowIntroSlides()).toBe(false)
  })
})

describe("intro slides with the new onboarding switched on (#482)", () => {
  it("show in a build that has introV2 off", () => {
    mocks.flags.introV2 = false
    window.localStorage.setItem("sponti.new-onboarding.v1", "on")
    resetNewOnboardingMemory()

    expect(shouldShowIntroSlides()).toBe(true)
  })
})
