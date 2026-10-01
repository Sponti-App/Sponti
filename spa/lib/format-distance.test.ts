import { describe, expect, it } from "vitest"

import { formatDistance } from "./format-distance"

describe("formatDistance", () => {
  it("shows metres under 1 km, rounded to 10 m", () => {
    expect(formatDistance(0)).toBe("0 m")
    expect(formatDistance(49)).toBe("50 m")
    expect(formatDistance(850)).toBe("850 m")
    expect(formatDistance(944)).toBe("940 m")
    expect(formatDistance(950)).toBe("950 m")
  })

  it("never shows a non-zero distance as 0 m", () => {
    expect(formatDistance(1)).toBe("10 m")
    expect(formatDistance(4)).toBe("10 m")
  })

  it("never renders 1000 m, it rolls over to km", () => {
    expect(formatDistance(995)).toBe("1.0 km")
    expect(formatDistance(999)).toBe("1.0 km")
    expect(formatDistance(1000)).toBe("1.0 km")
  })

  it("uses one decimal from 1 km up to 10 km", () => {
    expect(formatDistance(1200)).toBe("1.2 km")
    expect(formatDistance(8400)).toBe("8.4 km")
    expect(formatDistance(9_949)).toBe("9.9 km")
  })

  it("never renders 10.0 km, it rolls over to whole km", () => {
    expect(formatDistance(9_950)).toBe("10 km")
    expect(formatDistance(9_999)).toBe("10 km")
    expect(formatDistance(10_000)).toBe("10 km")
  })

  it("uses whole km from 10 km up", () => {
    expect(formatDistance(14_400)).toBe("14 km")
    expect(formatDistance(14_600)).toBe("15 km")
    expect(formatDistance(250_000)).toBe("250 km")
  })

  it("is defensive about bad input", () => {
    expect(formatDistance(-5)).toBe("0 m")
    expect(formatDistance(Number.NaN)).toBe("0 m")
  })
})
