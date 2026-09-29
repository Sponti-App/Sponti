import { describe, it, expect } from "vitest"
import { collapseProgress } from "./use-month-collapse"
import {
  monthCollapseDistance,
  monthWeekCount,
} from "@/components/month-calendar"

describe("collapseProgress", () => {
  it("is fully expanded at the top of the list", () => {
    expect(collapseProgress(0, 160)).toBe(0)
  })

  it("ramps linearly with scroll position", () => {
    expect(collapseProgress(80, 160)).toBe(0.5)
  })

  it("clamps to fully collapsed once scroll passes the distance", () => {
    expect(collapseProgress(400, 160)).toBe(1)
  })

  it("never goes negative for an upward-rubber-banded scroll position", () => {
    expect(collapseProgress(-20, 160)).toBe(0)
  })

  it("treats a zero distance as an instant toggle", () => {
    expect(collapseProgress(0, 0)).toBe(0)
    expect(collapseProgress(1, 0)).toBe(1)
  })

  it("moves the overlay edge 1px per 1px scrolled, so it never overtakes the list", () => {
    const distance = 160
    for (let scrollTop = 0; scrollTop <= distance; scrollTop += 20) {
      const hiddenByCollapse = collapseProgress(scrollTop, distance) * distance
      expect(hiddenByCollapse).toBeCloseTo(scrollTop)
    }
  })
})

describe("month grid geometry", () => {
  it("counts Monday-first week rows", () => {
    expect(monthWeekCount(new Date(2027, 1, 1))).toBe(4) // Feb 2027: Mon 1st, 28 days
    expect(monthWeekCount(new Date(2026, 8, 1))).toBe(5) // Sep 2026
    expect(monthWeekCount(new Date(2026, 7, 1))).toBe(6) // Aug 2026: Sat 1st
  })

  it("collapses by the height of every row but the pinned one", () => {
    expect(monthCollapseDistance(new Date(2027, 1, 1))).toBe(3 * 40)
    expect(monthCollapseDistance(new Date(2026, 8, 15))).toBe(4 * 40)
    expect(monthCollapseDistance(new Date(2026, 7, 31))).toBe(5 * 40)
  })

  it("uses the compact row step on short screens", () => {
    expect(monthCollapseDistance(new Date(2026, 7, 1), true)).toBe(5 * 32)
  })
})
