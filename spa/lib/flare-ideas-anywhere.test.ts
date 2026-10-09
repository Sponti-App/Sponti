import { describe, expect, it } from "vitest"

import { haversineMeters } from "@/lib/api/events/events.adapter"
import { EVENT_TYPES } from "@/types/utils"

import {
  ANYWHERE_PLACE_LINE,
  FLOATING_RADIUS_METERS,
  MAX_ANYWHERE_PINS,
  getAnywhereIdeas,
  isAnywhereInSeason,
  offsetCoords,
  placeFloatingIdeas,
  timeOfDay,
  type AnywhereIdea,
} from "./flare-ideas-anywhere"
import { ANYWHERE_IDEAS } from "./flare-ideas.anywhere.data"
import { FLARE_IDEAS } from "./flare-ideas.data"

const ANY = new Set<never>()

// Device-local dates: the picker reads the person's own clock and calendar.
const at = (month: number, day: number, hour: number) =>
  new Date(2026, month - 1, day, hour, 0, 0)

function idea(id: string, extra: Partial<AnywhereIdea> = {}): AnywhereIdea {
  return { id, title: id, category: "hangout", ...extra }
}

describe("the anywhere ideas list (#515)", () => {
  it("has 25 to 35 ideas with unique ids that never collide with a spot's", () => {
    expect(ANYWHERE_IDEAS.length).toBeGreaterThanOrEqual(25)
    expect(ANYWHERE_IDEAS.length).toBeLessThanOrEqual(35)
    const ids = [
      ...ANYWHERE_IDEAS.map((i) => i.id),
      ...FLARE_IDEAS.map((i) => i.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("is place-less, uses real categories and valid season windows", () => {
    const categories = new Set(EVENT_TYPES.map((t) => t.value))
    for (const i of ANYWHERE_IDEAS) {
      expect(i.place).toBeUndefined()
      expect(categories.has(i.category)).toBe(true)
      if (i.season) {
        expect(i.season.from).toMatch(/^\d{2}-\d{2}$/)
        expect(i.season.to).toMatch(/^\d{2}-\d{2}$/)
      }
      if (i.timeOfDay) expect(i.timeOfDay.length).toBeGreaterThan(0)
    }
  })

  it("is product copy: lowercase, no exclamation marks, short", () => {
    for (const i of ANYWHERE_IDEAS) {
      for (const text of [i.title, i.blurb ?? ""]) {
        expect(text).toBe(text.toLowerCase())
        expect(text).not.toContain("!")
        expect(text.length).toBeLessThanOrEqual(60)
      }
    }
  })

  it("covers every category, so a chip never finds nothing", () => {
    for (const { value } of EVENT_TYPES) {
      expect(ANYWHERE_IDEAS.some((i) => i.category === value)).toBe(true)
    }
  })

  it("has something to show at every hour of every month", () => {
    for (let month = 1; month <= 12; month++) {
      for (let hour = 0; hour < 24; hour++) {
        const picked = getAnywhereIdeas({
          now: at(month, 15, hour),
          categories: ANY,
        })
        expect(picked.length, `${month}/15 ${hour}h`).toBe(MAX_ANYWHERE_PINS)
      }
    }
  })
})

describe("timeOfDay", () => {
  it("cuts the day into four parts", () => {
    expect(timeOfDay(at(10, 8, 5))).toBe("morning")
    expect(timeOfDay(at(10, 8, 11))).toBe("morning")
    expect(timeOfDay(at(10, 8, 12))).toBe("afternoon")
    expect(timeOfDay(at(10, 8, 16))).toBe("afternoon")
    expect(timeOfDay(at(10, 8, 17))).toBe("evening")
    expect(timeOfDay(at(10, 8, 21))).toBe("evening")
    expect(timeOfDay(at(10, 8, 22))).toBe("night")
    expect(timeOfDay(at(10, 8, 4))).toBe("night")
  })
})

describe("isAnywhereInSeason", () => {
  const summer = idea("s", { season: { from: "06-01", to: "08-31" } })
  const winter = idea("w", { season: { from: "11-15", to: "01-06" } })

  it("is inclusive at both ends", () => {
    expect(isAnywhereInSeason(summer, at(6, 1, 12))).toBe(true)
    expect(isAnywhereInSeason(summer, at(8, 31, 12))).toBe(true)
    expect(isAnywhereInSeason(summer, at(5, 31, 12))).toBe(false)
    expect(isAnywhereInSeason(summer, at(9, 1, 12))).toBe(false)
  })

  it("wraps the new year", () => {
    expect(isAnywhereInSeason(winter, at(12, 24, 12))).toBe(true)
    expect(isAnywhereInSeason(winter, at(1, 6, 12))).toBe(true)
    expect(isAnywhereInSeason(winter, at(1, 7, 12))).toBe(false)
    expect(isAnywhereInSeason(winter, at(7, 1, 12))).toBe(false)
  })

  it("is never 'in season' without a window", () => {
    expect(isAnywhereInSeason(idea("a"), at(6, 1, 12))).toBe(false)
  })
})

describe("getAnywhereIdeas", () => {
  const now = at(10, 8, 19)

  it("returns at most the cap, three by default", () => {
    expect(getAnywhereIdeas({ now, categories: ANY })).toHaveLength(3)
    expect(getAnywhereIdeas({ now, categories: ANY, cap: 1 })).toHaveLength(1)
    expect(getAnywhereIdeas({ now, categories: ANY, cap: 0 })).toEqual([])
    expect(getAnywhereIdeas({ now, categories: ANY, cap: -2 })).toEqual([])
  })

  it("is the same for the same slot, so pins don't flicker", () => {
    const first = getAnywhereIdeas({ now: at(10, 8, 18), categories: ANY })
    expect(getAnywhereIdeas({ now: at(10, 8, 18), categories: ANY })).toEqual(
      first
    )
    // Same 3-hour slot, a different minute and hour.
    const later = new Date(2026, 9, 8, 20, 59, 59)
    expect(getAnywhereIdeas({ now: later, categories: ANY })).toEqual(first)
  })

  it("rotates over the day and from one day to the next", () => {
    const ids = (d: Date) =>
      getAnywhereIdeas({ now: d, categories: ANY }).map((i) => i.id)
    const slots = [6, 9, 12, 15, 18, 21].map((h) => ids(at(10, 8, h)).join())
    expect(new Set(slots).size).toBeGreaterThan(3)
    const days = [8, 9, 10, 11, 12, 13].map((d) => ids(at(10, d, 19)).join())
    expect(new Set(days).size).toBeGreaterThan(2)
  })

  it("never picks an idea out of season", () => {
    const pool = [
      idea("picnic", { season: { from: "04-15", to: "09-30" } }),
      idea("sofa"),
    ]
    const winter = getAnywhereIdeas({
      now: at(1, 20, 15),
      categories: ANY,
      ideas: pool,
    })
    expect(winter.map((i) => i.id)).toEqual(["sofa"])
    const summer = getAnywhereIdeas({
      now: at(7, 20, 15),
      categories: ANY,
      ideas: pool,
    })
    expect(summer.map((i) => i.id).sort()).toEqual(["picnic", "sofa"])
  })

  it("never picks an idea for another part of the day", () => {
    const pool = [
      idea("aperitif", { timeOfDay: ["evening"] }),
      idea("brunch", { timeOfDay: ["morning"] }),
      idea("sofa"),
    ]
    const ids = (hour: number) =>
      getAnywhereIdeas({ now: at(10, 8, hour), categories: ANY, ideas: pool })
        .map((i) => i.id)
        .sort()
    expect(ids(19)).toEqual(["aperitif", "sofa"])
    expect(ids(9)).toEqual(["brunch", "sofa"])
    expect(ids(14)).toEqual(["sofa"])
  })

  it("serves the apéritif in the evening and never at breakfast", () => {
    const evenings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].flatMap((month) =>
      getAnywhereIdeas({ now: at(month, 15, 19), categories: ANY, cap: 30 })
    )
    expect(evenings.some((i) => i.id === "anywhere-aperitif")).toBe(true)
    for (let month = 1; month <= 12; month++) {
      const morning = getAnywhereIdeas({
        now: at(month, 15, 8),
        categories: ANY,
        cap: 100,
      })
      expect(morning.some((i) => i.id === "anywhere-aperitif")).toBe(false)
    }
  })

  it("favours ideas that fit the season and the hour", () => {
    // Two seasonal ideas and eight plain ones, one pick: across many days the
    // seasonal pair should come up clearly more often than 2 in 10.
    const pool = [
      idea("a", { season: { from: "01-01", to: "12-31" }, category: "food" }),
      idea("b", { season: { from: "01-01", to: "12-31" }, category: "food" }),
      ...Array.from({ length: 8 }, (_, n) => idea(`plain-${n}`)),
    ]
    let hits = 0
    const days = 120
    for (let d = 0; d < days; d++) {
      const [picked] = getAnywhereIdeas({
        now: new Date(2026, 0, 1 + d, 19),
        categories: ANY,
        cap: 1,
        ideas: pool,
      })
      if (picked.id === "a" || picked.id === "b") hits++
    }
    // Weight 3 each against 1 each: about 6 in 14 (43%) against 2 in 10 (20%).
    expect(hits / days).toBeGreaterThan(0.3)
  })

  it("respects the category chips", () => {
    const drinks = getAnywhereIdeas({
      now,
      categories: new Set(["drinks"]),
      cap: 10,
    })
    expect(drinks.length).toBeGreaterThan(0)
    expect(drinks.every((i) => i.category === "drinks")).toBe(true)

    const two = getAnywhereIdeas({
      now,
      categories: new Set(["drinks", "food"]),
      cap: 10,
    })
    expect(two.some((i) => i.category === "food")).toBe(true)
    expect(two.some((i) => i.category === "drinks")).toBe(true)
    expect(two.every((i) => ["drinks", "food"].includes(i.category))).toBe(true)
  })

  it("returns nothing for a category the list lacks", () => {
    expect(
      getAnywhereIdeas({
        now,
        categories: new Set(["sports"]),
        ideas: [idea("a")],
      })
    ).toEqual([])
  })

  it("prefers different categories, and repeats one only to fill the cap", () => {
    const picked = getAnywhereIdeas({ now, categories: ANY })
    expect(new Set(picked.map((i) => i.category)).size).toBe(3)

    const sameOnly = getAnywhereIdeas({
      now,
      categories: ANY,
      ideas: [idea("a"), idea("b"), idea("c")],
    })
    expect(sameOnly).toHaveLength(3)
  })

  it("never picks the same idea twice", () => {
    for (let hour = 0; hour < 24; hour += 3) {
      const ids = getAnywhereIdeas({
        now: at(10, 8, hour),
        categories: ANY,
        cap: 12,
      }).map((i) => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe("offsetCoords", () => {
  const from = { lat: 52.52, lng: 13.4 }

  it("lands the asked distance away", () => {
    for (const bearing of [0, 45, 90, 180, 270, 315]) {
      const to = offsetCoords(from, bearing, 220)
      expect(haversineMeters(from, to)).toBeCloseTo(220, 0)
    }
  })

  it("heads the right way", () => {
    expect(offsetCoords(from, 0, 100).lat).toBeGreaterThan(from.lat)
    expect(offsetCoords(from, 180, 100).lat).toBeLessThan(from.lat)
    expect(offsetCoords(from, 90, 100).lng).toBeGreaterThan(from.lng)
    expect(offsetCoords(from, 270, 100).lng).toBeLessThan(from.lng)
  })
})

describe("placeFloatingIdeas", () => {
  const anchor = { lat: 52.52, lng: 13.4 }
  const three = [idea("a"), idea("b"), idea("c")]

  it("fans each idea out at the radius from the anchor", () => {
    const placed = placeFloatingIdeas({ anchor, ideas: three, obstacles: [] })
    expect(placed.map((i) => i.id)).toEqual(["a", "b", "c"])
    for (const p of placed) {
      expect(haversineMeters(anchor, p.position)).toBeCloseTo(
        FLOATING_RADIUS_METERS,
        0
      )
    }
  })

  it("keeps the pins well apart from each other and from the position dot", () => {
    const placed = placeFloatingIdeas({ anchor, ideas: three, obstacles: [] })
    for (const [i, a] of placed.entries()) {
      expect(haversineMeters(anchor, a.position)).toBeGreaterThan(150)
      for (const b of placed.slice(i + 1)) {
        expect(haversineMeters(a.position, b.position)).toBeGreaterThan(150)
      }
    }
  })

  it("is the same every time", () => {
    const first = placeFloatingIdeas({ anchor, ideas: three, obstacles: [] })
    expect(placeFloatingIdeas({ anchor, ideas: three, obstacles: [] })).toEqual(
      first
    )
  })

  it("keeps the idea's own fields", () => {
    const [placed] = placeFloatingIdeas({
      anchor,
      ideas: [idea("a", { blurb: "hi", category: "food" })],
      obstacles: [],
    })
    expect(placed).toMatchObject({ id: "a", blurb: "hi", category: "food" })
  })

  it("skips a bearing that would sit on a real pin", () => {
    const [clear] = placeFloatingIdeas({
      anchor,
      ideas: [idea("a")],
      obstacles: [],
    })
    const [moved] = placeFloatingIdeas({
      anchor,
      ideas: [idea("a")],
      obstacles: [clear.position],
    })
    expect(haversineMeters(clear.position, moved.position)).toBeGreaterThan(
      FLOATING_RADIUS_METERS * 0.4
    )
  })

  it("never draws one within clearance of an obstacle", () => {
    const obstacles = [
      offsetCoords(anchor, 315, 220),
      offsetCoords(anchor, 90, 200),
    ]
    const placed = placeFloatingIdeas({ anchor, ideas: three, obstacles })
    expect(placed).toHaveLength(3)
    for (const p of placed) {
      for (const o of obstacles) {
        expect(haversineMeters(p.position, o)).toBeGreaterThanOrEqual(
          FLOATING_RADIUS_METERS * 0.4
        )
      }
    }
  })

  it("drops ideas it has no free bearing for, rather than stacking them", () => {
    // An obstacle on the anchor itself blocks every bearing within clearance
    // of it only; a ring of obstacles blocks them all.
    const ring = [0, 45, 90, 135, 180, 225, 270, 315].map((b) =>
      offsetCoords(anchor, b, FLOATING_RADIUS_METERS)
    )
    expect(
      placeFloatingIdeas({ anchor, ideas: three, obstacles: ring })
    ).toEqual([])
  })

  it("scales with the radius", () => {
    const [far] = placeFloatingIdeas({
      anchor,
      ideas: [idea("a")],
      obstacles: [],
      radiusMeters: 800,
    })
    expect(haversineMeters(anchor, far.position)).toBeCloseTo(800, 0)
  })
})

describe("the place line", () => {
  it("is lowercase product copy", () => {
    expect(ANYWHERE_PLACE_LINE).toBe(ANYWHERE_PLACE_LINE.toLowerCase())
    expect(ANYWHERE_PLACE_LINE).toBe("at your place or wherever you are")
  })
})
