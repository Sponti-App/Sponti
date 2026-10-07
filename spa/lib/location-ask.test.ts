import { describe, expect, it } from "vitest"
import type { GeoStatus } from "./geolocation"
import {
  hasIdeaSpots,
  locationAskMode,
  locationAutoRequest,
  looksLikeBerlin,
  matchAreas,
  shouldRememberLocation,
  startCamera,
  type GeoPermission,
} from "./location-ask"
import { BERLIN_AREAS, type LocationChoice } from "./location-choice"

// #408: the location ask's state logic, without the hooks.

const KREUZBERG = BERLIN_AREAS[0]
const AREA: LocationChoice = { kind: "area", area: KREUZBERG }
const LOCATION: LocationChoice = { kind: "location" }
const FALLBACK = { lat: 52.5, lng: 13.42 }
const HERE = { lat: 48.1, lng: 11.6 }
const LAST = { lat: 37.77, lng: -122.42 }

function mode(
  over: Partial<{
    enabled: boolean
    choice: LocationChoice | null
    permission: GeoPermission
    requested: boolean
    geoStatus: GeoStatus
  }> = {}
) {
  return locationAskMode({
    enabled: true,
    choice: null,
    permission: "prompt",
    requested: false,
    geoStatus: "idle",
    ...over,
  })
}

describe("locationAutoRequest", () => {
  it("keeps today's behaviour with the flag off", () => {
    for (const byDefault of [true, false]) {
      expect(
        locationAutoRequest({
          enabled: false,
          choice: AREA,
          permission: "prompt",
          byDefault,
        })
      ).toBe(byDefault)
    }
  })

  it("never prompts on its own while undecided", () => {
    for (const permission of ["unknown", "prompt", "denied"] as const) {
      expect(
        locationAutoRequest({
          enabled: true,
          choice: null,
          permission,
          byDefault: true,
        })
      ).toBe(false)
    }
  })

  it("asks once location was chosen, or when the browser already allows it", () => {
    const base = { enabled: true, byDefault: false }
    expect(
      locationAutoRequest({ ...base, choice: LOCATION, permission: "prompt" })
    ).toBe(true)
    expect(
      locationAutoRequest({ ...base, choice: null, permission: "granted" })
    ).toBe(true)
    // A picked area stays picked, even when the browser would allow it.
    expect(
      locationAutoRequest({ ...base, choice: AREA, permission: "granted" })
    ).toBe(false)
  })
})

describe("locationAskMode", () => {
  it("is hidden with the flag off or once decided", () => {
    expect(mode({ enabled: false })).toBe("hidden")
    expect(mode({ choice: LOCATION })).toBe("hidden")
    expect(mode({ choice: AREA, permission: "denied" })).toBe("hidden")
  })

  it("waits for the permissions api, and skips the ask when it's granted", () => {
    expect(mode({ permission: "unknown" })).toBe("hidden")
    expect(mode({ permission: "granted" })).toBe("hidden")
  })

  it("asks while the browser would prompt, also while it's being asked", () => {
    expect(mode()).toBe("ask")
    expect(mode({ requested: true, geoStatus: "requesting" })).toBe("ask")
  })

  it("turns into the area picker when location is denied or blocked", () => {
    expect(mode({ permission: "denied" })).toBe("pick")
    for (const geoStatus of ["denied", "unavailable", "error"] as const) {
      expect(mode({ requested: true, geoStatus })).toBe("pick")
    }
  })

  it("closes once a position arrives", () => {
    expect(mode({ requested: true, geoStatus: "granted" })).toBe("hidden")
  })
})

describe("shouldRememberLocation", () => {
  it("remembers a granted position once, and only with the flag on", () => {
    expect(
      shouldRememberLocation({
        enabled: true,
        choice: null,
        geoStatus: "granted",
      })
    ).toBe(true)
    expect(
      shouldRememberLocation({
        enabled: true,
        choice: AREA,
        geoStatus: "granted",
      })
    ).toBe(true)
    expect(
      shouldRememberLocation({
        enabled: true,
        choice: LOCATION,
        geoStatus: "granted",
      })
    ).toBe(false)
    expect(
      shouldRememberLocation({
        enabled: true,
        choice: null,
        geoStatus: "denied",
      })
    ).toBe(false)
    expect(
      shouldRememberLocation({
        enabled: false,
        choice: null,
        geoStatus: "granted",
      })
    ).toBe(false)
  })
})

describe("startCamera", () => {
  const base = {
    enabled: true,
    choice: null,
    coords: null,
    lastKnown: null,
    useLastKnown: true,
    asking: false,
    fallback: FALLBACK,
    alwaysFallback: false,
  }

  it("is today's coords ?? lastKnown with the flag off", () => {
    expect(startCamera({ ...base, enabled: false, lastKnown: LAST })).toBe(LAST)
    expect(
      startCamera({ ...base, enabled: false, coords: HERE, lastKnown: LAST })
    ).toBe(HERE)
    expect(startCamera({ ...base, enabled: false, choice: AREA })).toBeNull()
  })

  it("prefers a live position, then a picked area, then the last known one", () => {
    expect(
      startCamera({ ...base, coords: HERE, choice: AREA, lastKnown: LAST })
    ).toBe(HERE)
    expect(startCamera({ ...base, choice: AREA, lastKnown: LAST })).toBe(
      KREUZBERG.center
    )
    expect(startCamera({ ...base, lastKnown: LAST })).toBe(LAST)
  })

  it("sits on the fallback behind the ask, or always when asked to", () => {
    expect(startCamera(base)).toBeNull()
    expect(startCamera({ ...base, asking: true })).toBe(FALLBACK)
    expect(startCamera({ ...base, alwaysFallback: true })).toBe(FALLBACK)
  })

  it("ignores the last known position when told to", () => {
    expect(
      startCamera({
        ...base,
        lastKnown: LAST,
        useLastKnown: false,
        alwaysFallback: true,
      })
    ).toBe(FALLBACK)
  })
})

describe("area search helpers", () => {
  it("matches the berlin chips by name, with or without umlauts", () => {
    expect(matchAreas("")).toHaveLength(BERLIN_AREAS.length)
    expect(matchAreas("KREUZ").map((a) => a.id)).toEqual(["kreuzberg"])
    expect(matchAreas("neukolln").map((a) => a.id)).toEqual(["neukoelln"])
    expect(matchAreas("neukoelln").map((a) => a.id)).toEqual(["neukoelln"])
    expect(matchAreas("hamburg")).toEqual([])
  })

  it("knows idea spots are berlin-only", () => {
    for (const area of BERLIN_AREAS)
      expect(hasIdeaSpots(area.center)).toBe(true)
    expect(hasIdeaSpots({ lat: 53.55, lng: 9.99 })).toBe(false)
  })

  it("spots a berlin suggestion by its address", () => {
    expect(looksLikeBerlin("Kreuzberg", "Berlin, Germany")).toBe(true)
    expect(looksLikeBerlin("Hamburg", "Germany")).toBe(false)
  })
})
