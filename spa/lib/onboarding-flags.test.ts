import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getOnboardingFlags,
  NEW_ONBOARDING_KEY,
  readNewOnboarding,
  resetNewOnboardingMemory,
  resolveOnboardingFlags,
  setNewOnboarding,
  useNewOnboarding,
  useOnboardingFlags,
} from "./onboarding-flags"

// #482: a device can switch the new onboarding's flags on at runtime. On, they
// all read as on whatever the build profile; off, the build profile decides.

const mocks = vi.hoisted(() => ({
  flags: {
    browseBeforeSignup: false,
    introV2: false,
    locationAsk: false,
    coachMarks: false,
  },
}))

vi.mock("@/lib/feature-flags", () => ({ featureFlags: mocks.flags }))

const TESTER = {
  browseBeforeSignup: false,
  introV2: false,
  locationAsk: false,
  coachMarks: false,
}
const ALL_ON = {
  browseBeforeSignup: true,
  introV2: true,
  locationAsk: true,
  coachMarks: true,
}

function buildProfile(flags: typeof TESTER) {
  Object.assign(mocks.flags, flags)
}

function breakStorage() {
  const boom = () => {
    throw new Error("SecurityError")
  }
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom)
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom)
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom)
}

beforeEach(() => {
  buildProfile(TESTER)
  window.localStorage.clear()
  resetNewOnboardingMemory()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("resolveOnboardingFlags", () => {
  it("leaves the build profile alone while the switch is off", () => {
    expect(resolveOnboardingFlags(TESTER, false)).toEqual(TESTER)
    expect(resolveOnboardingFlags(ALL_ON, false)).toEqual(ALL_ON)
  })

  it("turns every flag on when the switch is on", () => {
    expect(resolveOnboardingFlags(TESTER, true)).toEqual(ALL_ON)
    expect(resolveOnboardingFlags(ALL_ON, true)).toEqual(ALL_ON)
  })
})

describe("the new onboarding switch", () => {
  it("is off on a device that never turned it on", () => {
    expect(readNewOnboarding()).toBe(false)
    expect(getOnboardingFlags()).toEqual(TESTER)
  })

  it("turns the flags on, and back to the build profile when switched off", () => {
    setNewOnboarding(true)

    expect(readNewOnboarding()).toBe(true)
    expect(window.localStorage.getItem(NEW_ONBOARDING_KEY)).toBe("on")
    expect(getOnboardingFlags()).toEqual(ALL_ON)

    setNewOnboarding(false)

    expect(readNewOnboarding()).toBe(false)
    expect(window.localStorage.getItem(NEW_ONBOARDING_KEY)).toBeNull()
    expect(getOnboardingFlags()).toEqual(TESTER)
  })

  it("stays on after a reload", () => {
    setNewOnboarding(true)
    resetNewOnboardingMemory()

    expect(getOnboardingFlags()).toEqual(ALL_ON)
  })

  it("off, a full build profile stays on", () => {
    buildProfile(ALL_ON)

    expect(getOnboardingFlags()).toEqual(ALL_ON)
  })

  it("ignores anything else stored under the key", () => {
    window.localStorage.setItem(NEW_ONBOARDING_KEY, "nonsense")

    expect(readNewOnboarding()).toBe(false)
  })

  it("holds for the session when storage throws", () => {
    breakStorage()

    expect(readNewOnboarding()).toBe(false)
    expect(() => setNewOnboarding(true)).not.toThrow()
    expect(getOnboardingFlags()).toEqual(ALL_ON)
    expect(() => setNewOnboarding(false)).not.toThrow()
    expect(getOnboardingFlags()).toEqual(TESTER)
  })

  it("never changes featureFlags itself", () => {
    setNewOnboarding(true)

    expect(mocks.flags).toEqual(TESTER)
  })
})

describe("useOnboardingFlags", () => {
  it("is decided on the client, and follows the switch", () => {
    const { result } = renderHook(() => useOnboardingFlags())
    expect(result.current).toEqual({ ...TESTER, decided: true })

    act(() => setNewOnboarding(true))
    expect(result.current).toEqual({ ...ALL_ON, decided: true })

    act(() => setNewOnboarding(false))
    expect(result.current).toEqual({ ...TESTER, decided: true })
  })

  it("hands back the same object while nothing changed", () => {
    const { result, rerender } = renderHook(() => useOnboardingFlags())
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })

  it("follows a change made in another tab", () => {
    const { result } = renderHook(() => useOnboardingFlags())

    act(() => {
      window.localStorage.setItem(NEW_ONBOARDING_KEY, "on")
      window.dispatchEvent(
        new StorageEvent("storage", { key: NEW_ONBOARDING_KEY })
      )
    })

    expect(result.current.introV2).toBe(true)
  })

  it("reads as off, without throwing, when storage throws", () => {
    breakStorage()

    const { result } = renderHook(() => useOnboardingFlags())
    expect(result.current).toEqual({ ...TESTER, decided: true })

    act(() => setNewOnboarding(true))
    expect(result.current).toEqual({ ...ALL_ON, decided: true })
  })
})

describe("useNewOnboarding", () => {
  it("is the switch's own state", () => {
    const { result } = renderHook(() => useNewOnboarding())
    expect(result.current).toBe(false)

    act(() => setNewOnboarding(true))
    expect(result.current).toBe(true)
  })
})
