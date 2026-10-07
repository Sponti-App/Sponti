import { afterEach, describe, expect, it, vi } from "vitest"

// #93: NEXT_PUBLIC_FEATURE_PROFILE picks the compile-time profile that
// gates unfinished surfaces. Each flag must fail closed (tester) unless the
// env var explicitly says "full", so a misconfigured build never exposes a
// half-wired surface to external testers.

async function loadFlags() {
  vi.resetModules()
  return import("./feature-flags")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("featureFlags profile", () => {
  it("defaults to the tester profile (reshare and plusOne off) when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", undefined)
    const { featureFlags } = await loadFlags()
    expect(featureFlags.reshare).toBe(false)
    expect(featureFlags.plusOne).toBe(false)
    expect(featureFlags.browseBeforeSignup).toBe(false)
    expect(featureFlags.introV2).toBe(false)
    expect(featureFlags.coachMarks).toBe(false)
  })

  it("stays on the tester profile for any value other than 'full'", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "tester")
    const { featureFlags: tester } = await loadFlags()
    expect(tester.reshare).toBe(false)
    expect(tester.plusOne).toBe(false)

    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "not-a-real-profile")
    const { featureFlags: garbage } = await loadFlags()
    expect(garbage.reshare).toBe(false)
    expect(garbage.plusOne).toBe(false)
    expect(garbage.browseBeforeSignup).toBe(false)
    expect(garbage.introV2).toBe(false)
    expect(garbage.coachMarks).toBe(false)
  })

  it("turns on full-app flags when set to 'full'", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "full")
    const { featureFlags } = await loadFlags()
    expect(featureFlags.reshare).toBe(true)
    expect(featureFlags.plusOne).toBe(true)
    expect(featureFlags.browseBeforeSignup).toBe(true)
    expect(featureFlags.introV2).toBe(true)
    expect(featureFlags.coachMarks).toBe(true)
  })

  it("keeps seedDemoData reading its own env var, independent of the profile", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "full")
    vi.stubEnv("NEXT_PUBLIC_SEED_DEMO_DATA", undefined)
    const { featureFlags: full } = await loadFlags()
    expect(full.seedDemoData).toBe(false)

    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "tester")
    vi.stubEnv("NEXT_PUBLIC_SEED_DEMO_DATA", "true")
    const { featureFlags: tester } = await loadFlags()
    expect(tester.seedDemoData).toBe(true)
  })

  it("keeps the mobile gate on in both profiles, off only with NEXT_PUBLIC_MOBILE_GATE=off (#467)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MOBILE_GATE", undefined)
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", undefined)
    expect((await loadFlags()).featureFlags.mobileGate).toBe(true)

    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "full")
    expect((await loadFlags()).featureFlags.mobileGate).toBe(true)

    vi.stubEnv("NEXT_PUBLIC_MOBILE_GATE", "on")
    expect((await loadFlags()).featureFlags.mobileGate).toBe(true)

    vi.stubEnv("NEXT_PUBLIC_MOBILE_GATE", "off")
    expect((await loadFlags()).featureFlags.mobileGate).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "tester")
    expect((await loadFlags()).featureFlags.mobileGate).toBe(false)
  })
})
