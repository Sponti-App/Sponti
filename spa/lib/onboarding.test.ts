import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  completeOnboarding,
  dropPendingOnboarding,
  markOnboardingPending,
  ONBOARDING_KEY,
  resetOnboardingMemory,
  shouldShowOnboarding,
} from "./onboarding"

beforeEach(() => {
  window.localStorage.clear()
  resetOnboardingMemory()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("first-run intro seen state (#313)", () => {
  it("doesn't show without a new account", () => {
    expect(shouldShowOnboarding()).toBe(false)
  })

  it("shows after a new account, until it's finished", () => {
    markOnboardingPending()
    expect(shouldShowOnboarding()).toBe(true)

    completeOnboarding()
    expect(shouldShowOnboarding()).toBe(false)
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("done")
  })

  it("stays finished after a reload", () => {
    markOnboardingPending()
    completeOnboarding()
    resetOnboardingMemory()

    expect(shouldShowOnboarding()).toBe(false)
  })

  it("shows only once per device, even for a second new account", () => {
    markOnboardingPending()
    completeOnboarding()

    markOnboardingPending()

    expect(shouldShowOnboarding()).toBe(false)
  })

  it("an existing-account sign-in drops an unfinished intro", () => {
    markOnboardingPending()

    dropPendingOnboarding()

    expect(shouldShowOnboarding()).toBe(false)
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeNull()
  })

  it("an existing-account sign-in keeps a finished one finished", () => {
    completeOnboarding()

    dropPendingOnboarding()

    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("done")
  })

  it("still shows once for the session when storage throws", () => {
    const boom = () => {
      throw new Error("SecurityError")
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom)
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom)

    expect(shouldShowOnboarding()).toBe(false)
    expect(() => markOnboardingPending()).not.toThrow()
    expect(shouldShowOnboarding()).toBe(true)
    expect(() => completeOnboarding()).not.toThrow()
    expect(shouldShowOnboarding()).toBe(false)
  })
})
