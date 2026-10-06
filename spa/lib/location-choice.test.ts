import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  BERLIN_AREAS,
  LOCATION_CHOICE_KEY,
  parseLocationChoice,
  readLocationChoice,
  rememberLocationChoice,
  resetLocationChoiceMemory,
} from "./location-choice"

// #408: where the map starts is remembered once per device: the person's
// location, or an area they picked.

const KREUZBERG = BERLIN_AREAS[0]
const HAMBURG = {
  id: "place-hamburg",
  name: "hamburg",
  center: { lat: 53.55, lng: 9.99 },
}

beforeEach(() => {
  window.localStorage.clear()
  resetLocationChoiceMemory()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("parseLocationChoice", () => {
  it("reads location and a picked area", () => {
    expect(parseLocationChoice('{"kind":"location"}')).toEqual({
      kind: "location",
    })
    expect(
      parseLocationChoice(JSON.stringify({ kind: "area", area: HAMBURG }))
    ).toEqual({ kind: "area", area: HAMBURG })
  })

  it("drops anything extra on a stored area", () => {
    const raw = JSON.stringify({
      kind: "area",
      area: { ...HAMBURG, center: { ...HAMBURG.center, x: 1 }, extra: true },
    })
    expect(parseLocationChoice(raw)).toEqual({ kind: "area", area: HAMBURG })
  })

  it.each([
    ["nothing", null],
    ["an empty string", ""],
    ["broken json", "{"],
    ["an unknown kind", '{"kind":"elsewhere"}'],
    [
      "an area without a centre",
      '{"kind":"area","area":{"id":"x","name":"x"}}',
    ],
    [
      "an area off the globe",
      '{"kind":"area","area":{"id":"x","name":"x","center":{"lat":91,"lng":0}}}',
    ],
    [
      "an area with no name",
      '{"kind":"area","area":{"id":"x","name":" ","center":{"lat":1,"lng":1}}}',
    ],
  ])("treats %s as undecided", (_label, raw) => {
    expect(parseLocationChoice(raw)).toBeNull()
  })
})

describe("the stored choice (#408)", () => {
  it("is undecided on a new device", () => {
    expect(readLocationChoice()).toBeNull()
  })

  it("remembers a picked area across a reload", () => {
    rememberLocationChoice({ kind: "area", area: KREUZBERG })
    resetLocationChoiceMemory()

    expect(readLocationChoice()).toEqual({ kind: "area", area: KREUZBERG })
    expect(
      JSON.parse(window.localStorage.getItem(LOCATION_CHOICE_KEY) ?? "null")
    ).toEqual({ kind: "area", area: KREUZBERG })
  })

  it("lets location replace a picked area", () => {
    rememberLocationChoice({ kind: "area", area: KREUZBERG })
    rememberLocationChoice({ kind: "location" })

    expect(readLocationChoice()).toEqual({ kind: "location" })
  })

  it("returns the same object until the choice changes", () => {
    rememberLocationChoice({ kind: "area", area: KREUZBERG })
    const first = readLocationChoice()

    expect(readLocationChoice()).toBe(first)
    rememberLocationChoice({ kind: "area", area: HAMBURG })
    expect(readLocationChoice()).not.toBe(first)
  })

  it("still remembers for the session when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })

    expect(readLocationChoice()).toBeNull()
    rememberLocationChoice({ kind: "location" })
    expect(readLocationChoice()).toEqual({ kind: "location" })
  })
})
