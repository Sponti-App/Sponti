import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  getGoogleGeocodingApiKey,
  normalizeReverseGeocodeResponse,
  parseLatLngParams,
  reverseGeocodeUrl,
} from "./googleGeocode"

const params = (query: string) => new URLSearchParams(query)

describe("parseLatLngParams", () => {
  it("reads a valid lat/lng pair", () => {
    expect(parseLatLngParams(params("lat=37.7749&lng=-122.4194"))).toEqual({
      lat: 37.7749,
      lng: -122.4194,
    })
  })

  it.each([
    ["missing both", ""],
    ["missing lng", "lat=37.7"],
    ["not a number", "lat=abc&lng=-122.4"],
    ["latitude out of range", "lat=91&lng=-122.4"],
    ["longitude out of range", "lat=37.7&lng=181"],
  ])("returns null for %s", (_label, query) => {
    expect(parseLatLngParams(params(query))).toBeNull()
  })
})

describe("reverseGeocodeUrl", () => {
  it("builds a latlng query with the key", () => {
    const url = reverseGeocodeUrl({ lat: 37.7749, lng: -122.4194 }, "test-key")
    expect(url).toContain("latlng=37.7749%2C-122.4194")
    expect(url).toContain("key=test-key")
  })
})

// Google Geocoding API result shape, trimmed to what these tests exercise.
function resultWith(
  components: { long_name: string; types: string[] }[]
) {
  return {
    status: "OK",
    results: [{ address_components: components }],
  }
}

describe("normalizeReverseGeocodeResponse", () => {
  it("picks the neighborhood over sublocality and locality", () => {
    const data = resultWith([
      { long_name: "789 Valencia St", types: ["street_number"] },
      { long_name: "Valencia St", types: ["route"] },
      { long_name: "Mission District", types: ["neighborhood", "political"] },
      { long_name: "SF Downtown", types: ["sublocality", "sublocality_level_1"] },
      { long_name: "San Francisco", types: ["locality", "political"] },
      { long_name: "94103", types: ["postal_code"] },
    ])
    expect(normalizeReverseGeocodeResponse(data)).toEqual({
      area: "Mission District",
      locality: "San Francisco",
    })
  })

  it("falls back to sublocality when there is no neighborhood", () => {
    const data = resultWith([
      { long_name: "SF Downtown", types: ["sublocality", "sublocality_level_1"] },
      { long_name: "San Francisco", types: ["locality", "political"] },
    ])
    expect(normalizeReverseGeocodeResponse(data)).toEqual({
      area: "SF Downtown",
      locality: "San Francisco",
    })
  })

  it("falls back to locality when neither neighborhood nor sublocality exist", () => {
    const data = resultWith([
      { long_name: "San Francisco", types: ["locality", "political"] },
      { long_name: "California", types: ["administrative_area_level_1"] },
    ])
    expect(normalizeReverseGeocodeResponse(data)).toEqual({
      area: "San Francisco",
      locality: "San Francisco",
    })
  })

  it("never returns a street number or route as the area", () => {
    const data = resultWith([
      { long_name: "789 Valencia St", types: ["street_number"] },
      { long_name: "Valencia St", types: ["route"] },
    ])
    expect(normalizeReverseGeocodeResponse(data)).toEqual({
      area: null,
      locality: null,
    })
  })

  it("never returns a postal code as the area", () => {
    const data = resultWith([{ long_name: "94103", types: ["postal_code"] }])
    expect(normalizeReverseGeocodeResponse(data)).toEqual({
      area: null,
      locality: null,
    })
  })

  it("resolves nulls for ZERO_RESULTS", () => {
    expect(
      normalizeReverseGeocodeResponse({ status: "ZERO_RESULTS", results: [] })
    ).toEqual({ area: null, locality: null })
  })

  it("throws on a non-OK, non-ZERO_RESULTS status", () => {
    expect(() =>
      normalizeReverseGeocodeResponse({
        status: "REQUEST_DENIED",
        results: [],
      })
    ).toThrow()
  })

  it("throws on malformed payloads", () => {
    expect(() => normalizeReverseGeocodeResponse(null)).toThrow()
    expect(() =>
      normalizeReverseGeocodeResponse({ status: "OK", results: "nope" })
    ).toThrow()
  })
})

describe("getGoogleGeocodingApiKey", () => {
  const originalPlacesKey = process.env.GOOGLE_PLACES_API_KEY
  const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY

  beforeEach(() => {
    delete process.env.GOOGLE_PLACES_API_KEY
    delete process.env.GOOGLE_MAPS_API_KEY
  })

  afterEach(() => {
    if (originalPlacesKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY
    else process.env.GOOGLE_PLACES_API_KEY = originalPlacesKey
    if (originalMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY
    else process.env.GOOGLE_MAPS_API_KEY = originalMapsKey
  })

  it("returns an empty string when neither env var is set (missing-key case)", () => {
    expect(getGoogleGeocodingApiKey()).toBe("")
  })

  it("prefers GOOGLE_PLACES_API_KEY over GOOGLE_MAPS_API_KEY", () => {
    process.env.GOOGLE_PLACES_API_KEY = "places-key"
    process.env.GOOGLE_MAPS_API_KEY = "maps-key"
    expect(getGoogleGeocodingApiKey()).toBe("places-key")
  })

  it("falls back to GOOGLE_MAPS_API_KEY", () => {
    process.env.GOOGLE_MAPS_API_KEY = "maps-key"
    expect(getGoogleGeocodingApiKey()).toBe("maps-key")
  })
})
