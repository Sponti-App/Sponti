import { describe, it, expect } from "vitest"
import {
  snapFloorForState,
  inferEventType,
  resolveEventType,
  buildTimeRange,
} from "./new-event-drawer"

describe("snapFloorForState", () => {
  it("returns peek when no section is expanded and mode is now", () => {
    expect(snapFloorForState(null, "now")).toBe("380px")
  })

  it("returns mid when a section is expanded in now mode", () => {
    expect(snapFloorForState("when", "now")).toBe(0.7)
    expect(snapFloorForState("where", "now")).toBe(0.7)
    expect(snapFloorForState("who", "now")).toBe(0.7)
  })

  it("returns tall when mode is scheduled regardless of section", () => {
    expect(snapFloorForState(null, "scheduled")).toBe(0.93)
    expect(snapFloorForState("when", "scheduled")).toBe(0.93)
    expect(snapFloorForState("where", "scheduled")).toBe(0.93)
  })
})

describe("inferEventType", () => {
  it("returns null for empty string", () => {
    expect(inferEventType("")).toBeNull()
  })

  it("infers drinks for bar-related titles", () => {
    expect(inferEventType("beers at the pub")).toBe("drinks")
    expect(inferEventType("cocktails tonight")).toBe("drinks")
  })

  it("infers food for dining titles", () => {
    expect(inferEventType("pizza night")).toBe("food")
    expect(inferEventType("brunch at cafe")).toBe("food")
  })

  it("infers sports for activity titles", () => {
    expect(inferEventType("morning run")).toBe("sports")
    expect(inferEventType("tennis match")).toBe("sports")
  })

  it("infers hangout for casual titles", () => {
    expect(inferEventType("chill at the park")).toBe("hangout")
    expect(inferEventType("afternoon stroll")).toBe("hangout")
  })

  it("returns null when nothing matches", () => {
    expect(inferEventType("meeting about Q3")).toBeNull()
  })

  it("matches most-specific type first (drinks before hangout)", () => {
    expect(inferEventType("drinks and a hang")).toBe("drinks")
  })
})

describe("resolveEventType", () => {
  it("uses manual pick when present", () => {
    expect(resolveEventType("party", "drinks")).toBe("party")
  })

  it("falls back to inferred when no manual pick", () => {
    expect(resolveEventType(null, "food")).toBe("food")
  })

  it("falls back to hangout when both are null", () => {
    expect(resolveEventType(null, null)).toBe("hangout")
  })
})

describe("buildTimeRange", () => {
  it("computes now-mode range from createdAt + offset", () => {
    const result = buildTimeRange({
      mode: "now",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 0,
      startDate: "2026-07-15",
      startTimeMin: 0,
      durationMin: 60,
    })
    expect(result.startAt).toBe("2026-07-15T12:00:00.000Z")
    const endMs =
      new Date("2026-07-15T12:00:00.000Z").getTime() + 60 * 60_000
    expect(result.endAt).toBe(new Date(endMs).toISOString())
  })

  it("applies startOffsetMin for delayed now-mode starts", () => {
    const result = buildTimeRange({
      mode: "now",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 30,
      startDate: "2026-07-15",
      startTimeMin: 0,
      durationMin: 60,
    })
    const expectedStart =
      new Date("2026-07-15T12:00:00.000Z").getTime() + 30 * 60_000
    expect(result.startAt).toBe(new Date(expectedStart).toISOString())
  })

  it("computes scheduled-mode range from date + time", () => {
    const result = buildTimeRange({
      mode: "scheduled",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 0,
      startDate: "2026-07-15",
      startTimeMin: 19 * 60,
      durationMin: 120,
    })
    const start = new Date("2026-07-15T00:00:00")
    start.setMinutes(start.getMinutes() + 19 * 60)
    expect(result.startAt).toBe(start.toISOString())
    const end = new Date(start.getTime() + 120 * 60_000)
    expect(result.endAt).toBe(end.toISOString())
  })

  it("uses open-ended fallback (480min) when durationMin is null", () => {
    const result = buildTimeRange({
      mode: "now",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 0,
      startDate: "2026-07-15",
      startTimeMin: 0,
      durationMin: null,
    })
    const expectedEnd =
      new Date("2026-07-15T12:00:00.000Z").getTime() + 480 * 60_000
    expect(result.endAt).toBe(new Date(expectedEnd).toISOString())
  })
})
