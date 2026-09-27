import { describe, it, expect } from "vitest"
import { collapseProgress } from "./use-month-collapse"

describe("collapseProgress", () => {
  it("is fully expanded at the top of the list", () => {
    expect(collapseProgress(0, 120, false)).toBe(0)
  })

  it("ramps linearly with scroll position", () => {
    expect(collapseProgress(60, 120, false)).toBe(0.5)
  })

  it("clamps to fully collapsed once scroll passes the distance", () => {
    expect(collapseProgress(400, 120, false)).toBe(1)
  })

  it("never goes negative for an upward-rubber-banded scroll position", () => {
    expect(collapseProgress(-20, 120, false)).toBe(0)
  })

  it("treats a zero distance as an instant toggle", () => {
    expect(collapseProgress(0, 0, false)).toBe(0)
    expect(collapseProgress(1, 0, false)).toBe(1)
  })

  it("steps instantly rather than ramping when reduced motion is requested", () => {
    expect(collapseProgress(59, 120, true)).toBe(0)
    expect(collapseProgress(60, 120, true)).toBe(1)
    expect(collapseProgress(119, 120, true)).toBe(1)
  })
})
