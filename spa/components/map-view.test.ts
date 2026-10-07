import { describe, it, expect } from "vitest"
import type { EventItem, EventType } from "@/lib/api/events"
import { bottomOccupiedCss, quietFlareType, swipeClosesSheet } from "./map-view"

// --sponti-bottom-occupied is the distance from the viewport bottom to the
// top of whatever the map docks on the nav, so bottom-docked UI outside the
// map (the action-feedback toast) can sit above it. See #112 and #223.
describe("bottomOccupiedCss", () => {
  it("peek: reserves the nav plus the dock, since the dock sits on the nav", () => {
    expect(bottomOccupiedCss("peek", 104)).toBe(
      "calc(var(--sponti-nav-h, 64px) + 104px)"
    )
  })

  it("mid: reserves the nav plus the taller dock (rail included), rounded to whole pixels", () => {
    expect(bottomOccupiedCss("mid", 231.6)).toBe(
      "calc(var(--sponti-nav-h, 64px) + 232px)"
    )
  })

  it("full: reserves just the nav, so bottom-docked UI floats above the nav rather than halfway up the list", () => {
    expect(bottomOccupiedCss("full", 231)).toBe("var(--sponti-nav-h, 64px)")
  })
})

const NOW = Date.parse("2026-09-29T18:00:00.000Z")
const MIN = 60_000

function flare(type: EventType, startOffsetMin: number, endOffsetMin: number) {
  return {
    type,
    startAt: new Date(NOW + startOffsetMin * MIN).toISOString(),
    endAt: new Date(NOW + endOffsetMin * MIN).toISOString(),
  } as EventItem
}

// The quiet state (#223): exactly one type chip on and nothing of that type
// live means the map suggests lighting one, and the nav shows its icon.
describe("quietFlareType", () => {
  it("is off with no type selected, even on an empty map", () => {
    expect(quietFlareType(new Set(), [], NOW)).toBeNull()
  })

  it("is the selected type when no flare of it is live", () => {
    expect(
      quietFlareType(
        new Set<EventType>(["food"]),
        [flare("drinks", -10, 60)],
        NOW
      )
    ).toBe("food")
  })

  it("is off once a live flare of the selected type is in the results", () => {
    expect(
      quietFlareType(
        new Set<EventType>(["drinks"]),
        [flare("drinks", -10, 60)],
        NOW
      )
    ).toBeNull()
  })

  it("still suggests the type when its flares are only upcoming or ended", () => {
    expect(
      quietFlareType(
        new Set<EventType>(["drinks"]),
        [flare("drinks", 30, 120), flare("drinks", -120, -30)],
        NOW
      )
    ).toBe("drinks")
  })

  it("is off with a second type selected", () => {
    expect(
      quietFlareType(new Set<EventType>(["food", "party"]), [], NOW)
    ).toBeNull()
  })
})

// #492: when a downward drag on the list page's handle closes it.
describe("swipeClosesSheet", () => {
  it("closes past 100px, however slow", () => {
    expect(swipeClosesSheet(100, 2000)).toBe(true)
    expect(swipeClosesSheet(99, 2000)).toBe(false)
  })

  it("closes on a quick flick over a short distance", () => {
    expect(swipeClosesSheet(40, 60)).toBe(true)
  })

  it("a tiny jiggle never closes, however fast", () => {
    expect(swipeClosesSheet(10, 5)).toBe(false)
  })

  it("an upward or zero drag never closes", () => {
    expect(swipeClosesSheet(0, 0)).toBe(false)
  })
})
