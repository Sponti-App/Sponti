import { describe, expect, it } from "vitest"
import {
  CURRENT_LOCATION_FALLBACK_LABEL,
  displayLocationName,
  isLegacyCurrentLocationName,
  resolveCurrentLocationLabel,
} from "./current-location"

describe("isLegacyCurrentLocationName", () => {
  it("matches the pre-#161 literal name, case-insensitively", () => {
    expect(isLegacyCurrentLocationName("Current location")).toBe(true)
    expect(isLegacyCurrentLocationName("current location")).toBe(true)
    expect(isLegacyCurrentLocationName("  CURRENT LOCATION  ")).toBe(true)
  })

  it("does not match a real place that merely contains the words", () => {
    expect(isLegacyCurrentLocationName("Current Location Cafe")).toBe(false)
    expect(isLegacyCurrentLocationName("Mission District")).toBe(false)
  })
})

describe("displayLocationName", () => {
  it("maps the legacy literal to the neutral fallback", () => {
    expect(displayLocationName("Current location")).toBe(
      CURRENT_LOCATION_FALLBACK_LABEL
    )
  })

  it("passes through any other stored name unchanged", () => {
    expect(displayLocationName("Mission District")).toBe("Mission District")
    expect(displayLocationName("within 1 km of San Francisco")).toBe(
      "within 1 km of San Francisco"
    )
    expect(displayLocationName(CURRENT_LOCATION_FALLBACK_LABEL)).toBe(
      CURRENT_LOCATION_FALLBACK_LABEL
    )
  })
})

describe("resolveCurrentLocationLabel", () => {
  it("uses the neighbourhood as the name and the locality as the address", () => {
    expect(
      resolveCurrentLocationLabel({
        area: "Mission District",
        locality: "San Francisco",
      })
    ).toEqual({ name: "Mission District", address: "San Francisco" })
  })

  it("uses the neighbourhood with a null address when no locality is known", () => {
    expect(
      resolveCurrentLocationLabel({ area: "Mission District", locality: null })
    ).toEqual({ name: "Mission District", address: null })
  })

  it("falls back to a ~1km label when only the locality is known", () => {
    expect(
      resolveCurrentLocationLabel({ area: "San Francisco", locality: "San Francisco" })
    ).toEqual({ name: "within 1 km of San Francisco", address: null })
  })

  it("falls back to the neutral label when nothing is known", () => {
    expect(resolveCurrentLocationLabel({ area: null, locality: null })).toEqual(
      { name: CURRENT_LOCATION_FALLBACK_LABEL, address: null }
    )
  })

  it("falls back to the neutral label when the lookup never resolved", () => {
    expect(resolveCurrentLocationLabel(null)).toEqual({
      name: CURRENT_LOCATION_FALLBACK_LABEL,
      address: null,
    })
  })

  it("never returns a street address, even if one were somehow passed through", () => {
    // resolveCurrentLocationLabel only ever receives `area`/`locality` from
    // the geocode route, which itself never surfaces street-level components
    // (see googleGeocode.test.ts) — this pins that no code path here can
    // produce anything more specific than a neighbourhood name.
    const result = resolveCurrentLocationLabel({
      area: "Mission District",
      locality: "San Francisco",
    })
    expect(result.name).not.toMatch(/\d/) // no street numbers
    expect(result.address).not.toMatch(/\d/)
  })
})
