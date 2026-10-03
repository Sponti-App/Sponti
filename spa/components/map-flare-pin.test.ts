import { describe, expect, it } from "vitest"
import type { EventItem } from "@/lib/api/events"
import {
  flareTitle,
  pinChipLabel,
  popoverTimeLabel,
  timeLeftLabel,
} from "./map-flare-pin"

const NOW = Date.parse("2026-06-15T12:00:00.000Z")
const MIN = 60_000

function flare(startOffsetMin: number, endOffsetMin: number): EventItem {
  return {
    id: "e1",
    title: "drinks · rooftop",
    type: "drinks",
    visibility: "private",
    startAt: new Date(NOW + startOffsetMin * MIN).toISOString(),
    endAt: new Date(NOW + endOffsetMin * MIN).toISOString(),
  } as unknown as EventItem
}

describe("map flare pin labels (#315)", () => {
  it("keeps the title before the ·", () => {
    expect(flareTitle(flare(0, 60))).toBe("drinks")
  })

  it("formats the time left", () => {
    expect(timeLeftLabel(40 * MIN)).toBe("40 min")
    expect(timeLeftLabel(70 * MIN)).toBe("1h 10m")
    expect(timeLeftLabel(120 * MIN)).toBe("2h")
  })

  it("chips a live flare as live, and your own with you first", () => {
    expect(pinChipLabel(flare(-10, 30), false, NOW)).toBe("live")
    expect(pinChipLabel(flare(-10, 30), true, NOW)).toBe("you · live")
    expect(pinChipLabel(flare(-90, -30), false, NOW)).toBe("ended")
  })

  it("chips a soon flare with a lowercase time", () => {
    const label = pinChipLabel(flare(120, 180), false, NOW)
    expect(label).toBe(label.toLowerCase())
    expect(label).not.toBe("live")
  })

  it("gives the popover the time left or the start", () => {
    expect(popoverTimeLabel(flare(-10, 70), NOW)).toBe("live · ends in 1h 10m")
    expect(popoverTimeLabel(flare(60, 120), NOW)).toMatch(/^starts /)
  })
})
