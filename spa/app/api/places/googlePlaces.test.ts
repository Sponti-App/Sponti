import { describe, expect, it } from "vitest"
import {
  AUTOCOMPLETE_BIAS_RADIUS_M,
  autocompleteRequestBody,
  normalizePlaceDetailsResponse,
  PLACE_DETAILS_FIELD_MASK,
  parseBiasParams,
} from "./googlePlaces"

const params = (query: string) => new URLSearchParams(query)

describe("parseBiasParams", () => {
  it("reads a valid lat/lng pair", () => {
    expect(parseBiasParams(params("lat=52.52&lng=13.405"))).toEqual({
      lat: 52.52,
      lng: 13.405,
    })
  })

  it.each([
    ["missing both", ""],
    ["missing lng", "lat=52.5"],
    ["not a number", "lat=abc&lng=13.4"],
    ["latitude out of range", "lat=91&lng=13.4"],
    ["longitude out of range", "lat=52.5&lng=181"],
  ])("ignores %s so the search stays unbiased", (_label, query) => {
    expect(parseBiasParams(params(query))).toBeNull()
  })
})

describe("autocompleteRequestBody", () => {
  it("sends only the trimmed input without a bias point", () => {
    expect(autocompleteRequestBody("  coffee  ", null)).toEqual({
      input: "coffee",
    })
  })

  it("adds a circular location bias around the user", () => {
    expect(
      autocompleteRequestBody("coffee", { lat: 52.52, lng: 13.405 })
    ).toEqual({
      input: "coffee",
      locationBias: {
        circle: {
          center: { latitude: 52.52, longitude: 13.405 },
          radius: AUTOCOMPLETE_BIAS_RADIUS_M,
        },
      },
    })
  })
})

describe("normalizePlaceDetailsResponse", () => {
  const details = {
    id: "p1",
    displayName: { text: "ACUD Theater" },
    formattedAddress: "Veteranenstr. 21, Berlin",
    location: { latitude: 52.54, longitude: 13.4 },
  }

  it("asks Google for the place's primary type", () => {
    expect(PLACE_DETAILS_FIELD_MASK.split(",")).toContain("primaryType")
  })

  it("carries the primary type through", () => {
    expect(
      normalizePlaceDetailsResponse(
        { ...details, primaryType: "performing_arts_theater" },
        "p1"
      )
    ).toEqual({
      placeId: "p1",
      name: "ACUD Theater",
      address: "Veteranenstr. 21, Berlin",
      lat: 52.54,
      lng: 13.4,
      primaryType: "performing_arts_theater",
    })
  })

  it("has a null primary type when Google sent none", () => {
    expect(normalizePlaceDetailsResponse(details, "p1")?.primaryType).toBeNull()
  })
})
