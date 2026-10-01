import { describe, expect, it } from "vitest"

import { EVENT_TYPES } from "@/types/utils"

import {
  IDEA_PIN_CLEARANCE_METERS,
  MAX_IDEA_PINS,
  getIdeaPins,
  getIdeasNear,
  isInSeason,
  type FlareIdea,
} from "./flare-ideas"
import { FLARE_IDEAS } from "./flare-ideas.data"

const CENTER = { lat: 52.52, lng: 13.4 }

// 0.01 degrees of latitude is about 1.11 km, so `at(n)` is roughly n * 1.11 km
// due north of CENTER.
const at = (hundredths: number) => ({
  lat: CENTER.lat + hundredths * 0.01,
  lng: CENTER.lng,
})

function idea(
  id: string,
  hundredths: number,
  extra: Partial<FlareIdea> = {}
): FlareIdea {
  return {
    id,
    title: id,
    category: "hangout",
    place: { name: id, ...at(hundredths) },
    ...extra,
  }
}

// Noon UTC keeps the berlin calendar day equal to the utc day all year.
const on = (isoDate: string) => new Date(`${isoDate}T12:00:00.000Z`)

const ids = (list: FlareIdea[]) => list.map((i) => i.id)

describe("isInSeason", () => {
  const june = idea("june", 0, { season: { from: "06-01", to: "06-30" } })
  const wrap = idea("wrap", 0, { season: { from: "12-20", to: "01-10" } })

  it("is false for an idea with no season", () => {
    expect(isInSeason(idea("always", 0), on("2026-06-15"))).toBe(false)
  })

  it("includes both ends of a window inside one year", () => {
    expect(isInSeason(june, on("2026-05-31"))).toBe(false)
    expect(isInSeason(june, on("2026-06-01"))).toBe(true)
    expect(isInSeason(june, on("2026-06-15"))).toBe(true)
    expect(isInSeason(june, on("2026-06-30"))).toBe(true)
    expect(isInSeason(june, on("2026-07-01"))).toBe(false)
  })

  it("handles a window that wraps the new year", () => {
    expect(isInSeason(wrap, on("2026-12-19"))).toBe(false)
    expect(isInSeason(wrap, on("2026-12-20"))).toBe(true)
    expect(isInSeason(wrap, on("2026-12-31"))).toBe(true)
    expect(isInSeason(wrap, on("2027-01-01"))).toBe(true)
    expect(isInSeason(wrap, on("2027-01-10"))).toBe(true)
    expect(isInSeason(wrap, on("2027-01-11"))).toBe(false)
    expect(isInSeason(wrap, on("2026-07-04"))).toBe(false)
  })

  it("reads the window on the berlin calendar day, not utc", () => {
    // 23:30 utc on 31 may is already 1 june in berlin (utc+2 in summer).
    expect(isInSeason(june, new Date("2026-05-31T23:30:00.000Z"))).toBe(true)
    // 22:30 utc on 30 june is already 1 july in berlin.
    expect(isInSeason(june, new Date("2026-06-30T22:30:00.000Z"))).toBe(false)
  })
})

describe("getIdeasNear", () => {
  it("excludes ideas farther than the radius and keeps the default at 2 km", () => {
    const list = [idea("near", 1), idea("edge", 1.5), idea("far", 2)]
    // 1 -> ~1.1 km, 1.5 -> ~1.7 km, 2 -> ~2.2 km
    expect(
      ids(getIdeasNear({ center: CENTER, now: on("2026-03-01"), ideas: list }))
    ).toEqual(["near", "edge"])
  })

  it("honours an explicit radius", () => {
    const list = [idea("near", 1), idea("far", 2)]
    const now = on("2026-03-01")
    expect(
      ids(getIdeasNear({ center: CENTER, now, radiusKm: 1, ideas: list }))
    ).toEqual([])
    expect(
      ids(getIdeasNear({ center: CENTER, now, radiusKm: 3, ideas: list }))
    ).toEqual(["near", "far"])
  })

  it("never returns an out-of-season idea, even when it is the nearest", () => {
    const list = [
      idea("summer-lake", 0, { season: { from: "06-01", to: "09-15" } }),
      idea("park", 1),
    ]
    expect(
      ids(getIdeasNear({ center: CENTER, now: on("2026-01-15"), ideas: list }))
    ).toEqual(["park"])
  })

  it("includes a wrapping window on both sides of the new year", () => {
    const list = [
      idea("xmas-to-jan", 1, { season: { from: "12-20", to: "01-10" } }),
    ]
    for (const day of ["2026-12-25", "2027-01-05"]) {
      expect(
        ids(getIdeasNear({ center: CENTER, now: on(day), ideas: list }))
      ).toEqual(["xmas-to-jan"])
    }
    expect(
      getIdeasNear({ center: CENTER, now: on("2027-02-01"), ideas: list })
    ).toEqual([])
  })

  it("puts in-season ideas first, then everything else, each nearest first", () => {
    const list = [
      idea("plain-near", 0.5),
      idea("plain-far", 1.5),
      idea("season-far", 1.6, { season: { from: "06-01", to: "06-30" } }),
      idea("season-near", 1, { season: { from: "06-01", to: "06-30" } }),
    ]
    expect(
      ids(getIdeasNear({ center: CENTER, now: on("2026-06-10"), ideas: list }))
    ).toEqual(["season-near", "season-far", "plain-near", "plain-far"])
  })

  it("breaks distance ties by id so the order is stable", () => {
    const list = [idea("b", 1), idea("a", 1)]
    expect(
      ids(getIdeasNear({ center: CENTER, now: on("2026-03-01"), ideas: list }))
    ).toEqual(["a", "b"])
  })

  it("filters by category", () => {
    const list = [
      idea("walk", 0.5),
      idea("beer", 1, { category: "drinks" }),
      idea("swim", 1.2, { category: "sports" }),
    ]
    const now = on("2026-03-01")
    expect(
      ids(
        getIdeasNear({ center: CENTER, now, category: "drinks", ideas: list })
      )
    ).toEqual(["beer"])
    expect(
      ids(getIdeasNear({ center: CENTER, now, category: "food", ideas: list }))
    ).toEqual([])
  })

  it("applies the limit after ordering", () => {
    const list = [
      idea("plain", 0.5),
      idea("season", 1, { season: { from: "06-01", to: "06-30" } }),
      idea("plain-2", 1.2),
    ]
    const now = on("2026-06-10")
    expect(
      ids(getIdeasNear({ center: CENTER, now, limit: 2, ideas: list }))
    ).toEqual(["season", "plain"])
    expect(
      getIdeasNear({ center: CENTER, now, limit: 0, ideas: list })
    ).toEqual([])
    expect(
      getIdeasNear({ center: CENTER, now, limit: 10, ideas: list })
    ).toHaveLength(3)
  })

  it("is deterministic for the same inputs and does not mutate the list", () => {
    const list = [idea("b", 1), idea("a", 0.5)]
    const snapshot = [...list]
    const args = { center: CENTER, now: on("2026-03-01"), ideas: list }
    expect(getIdeasNear(args)).toEqual(getIdeasNear(args))
    expect(list).toEqual(snapshot)
  })

  it("uses the curated berlin list by default", () => {
    // Humboldthain, in the middle of june: the rose garden is in bloom.
    const result = getIdeasNear({
      center: { lat: 52.5474, lng: 13.3873 },
      now: on("2026-06-15"),
    })
    expect(result[0]?.id).toBe("humboldthain-rose-garden")

    // Same spot in january: the rose garden is gone.
    const winter = getIdeasNear({
      center: { lat: 52.5474, lng: 13.3873 },
      now: on("2026-01-15"),
    })
    expect(ids(winter)).not.toContain("humboldthain-rose-garden")
  })

  it("finds nothing outside berlin", () => {
    expect(
      getIdeasNear({
        center: { lat: 48.1351, lng: 11.582 },
        now: on("2026-06-15"),
      })
    ).toEqual([])
  })
})

describe("FLARE_IDEAS data", () => {
  it("has about twenty entries covering all seven categories", () => {
    expect(FLARE_IDEAS.length).toBeGreaterThanOrEqual(20)
    const covered = new Set(FLARE_IDEAS.map((i) => i.category))
    for (const { value } of EVENT_TYPES) {
      expect(covered.has(value)).toBe(true)
    }
  })

  it("uses unique kebab-case ids", () => {
    const all = FLARE_IDEAS.map((i) => i.id)
    expect(new Set(all).size).toBe(all.length)
    for (const id of all) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("keeps every coordinate inside berlin", () => {
    for (const { id, place } of FLARE_IDEAS) {
      expect(place.lat, id).toBeGreaterThan(52.33)
      expect(place.lat, id).toBeLessThan(52.68)
      expect(place.lng, id).toBeGreaterThan(13.08)
      expect(place.lng, id).toBeLessThan(13.77)
    }
  })

  it("writes product copy in lowercase without exclamation marks", () => {
    for (const { id, title, blurb } of FLARE_IDEAS) {
      for (const copy of [title, blurb]) {
        if (copy === undefined) continue
        expect(copy, id).toBe(copy.toLowerCase())
        expect(copy, id).not.toContain("!")
      }
    }
  })

  it("has well-formed season windows, at least one of which wraps the year", () => {
    const seasonal = FLARE_IDEAS.filter((i) => i.season)
    expect(seasonal.length).toBeGreaterThanOrEqual(5)
    for (const { id, season } of seasonal) {
      for (const value of [season!.from, season!.to]) {
        expect(value, id).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
      }
    }
    expect(seasonal.some((i) => i.season!.from > i.season!.to)).toBe(true)
  })
})

describe("getIdeaPins", () => {
  const NOW = on("2026-03-10")
  const none = new Set<never>()
  const pins = (
    ideas: FlareIdea[],
    extra: Partial<Parameters<typeof getIdeaPins>[0]> = {}
  ) =>
    ids(
      getIdeaPins({
        center: CENTER,
        now: NOW,
        categories: none,
        flarePositions: [],
        ideas,
        ...extra,
      })
    )

  it("with no chip on, pins ideas of every category, nearest first", () => {
    const list = [
      idea("far", 1.5, { category: "food" }),
      idea("near", 0.5, { category: "drinks" }),
    ]
    expect(pins(list)).toEqual(["near", "far"])
  })

  it("with chips on, pins only ideas of those categories", () => {
    const list = [
      idea("a", 0.2, { category: "food" }),
      idea("b", 0.3, { category: "drinks" }),
      idea("c", 0.4, { category: "party" }),
    ]
    expect(pins(list, { categories: new Set(["food"]) })).toEqual(["a"])
    expect(pins(list, { categories: new Set(["food", "party"]) })).toEqual([
      "a",
      "c",
    ])
  })

  it("keeps the selector's range and season rules", () => {
    const list = [
      idea("in-range", 1),
      idea("too-far", 3),
      idea("off-season", 0.1, { season: { from: "06-01", to: "06-30" } }),
    ]
    expect(pins(list)).toEqual(["in-range"])
  })

  it("drops an idea sitting on a flare's pin, and lets the next one in", () => {
    const list = [idea("on-flare", 0.5), idea("clear", 1)]
    // 0.001 degrees of latitude is about 111 m: beyond the clearance.
    const flare = (hundredths: number) => at(hundredths)
    expect(pins(list, { flarePositions: [flare(0.5)] })).toEqual(["clear"])
    expect(pins(list, { flarePositions: [flare(0.5 + 0.1)] })).toEqual([
      "on-flare",
      "clear",
    ])
  })

  it("clears ideas closer than the clearance, keeps those just outside", () => {
    // ~0.00045 degrees of latitude is about 50 m, ~0.001 about 111 m.
    const flare = { lat: CENTER.lat + 0.005, lng: CENTER.lng }
    const list = [idea("close", 0.5 + 0.045), idea("outside", 0.5 + 0.1)]
    expect(IDEA_PIN_CLEARANCE_METERS).toBeGreaterThan(50)
    expect(IDEA_PIN_CLEARANCE_METERS).toBeLessThan(111)
    expect(pins(list, { flarePositions: [flare] })).toEqual(["outside"])
  })

  it("caps the pins, nearest and in-season first", () => {
    const list = Array.from({ length: 9 }, (_, i) =>
      idea(`i${i}`, 0.1 * (i + 1))
    )
    expect(pins(list)).toHaveLength(MAX_IDEA_PINS)
    expect(pins(list)).toEqual(["i0", "i1", "i2", "i3", "i4"])
    expect(pins(list, { cap: 2 })).toEqual(["i0", "i1"])
    expect(pins(list, { cap: 0 })).toEqual([])
  })

  it("is empty for an empty list", () => {
    expect(pins([])).toEqual([])
  })
})
