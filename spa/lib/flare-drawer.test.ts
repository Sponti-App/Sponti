import { describe, expect, it } from "vitest"
import type { HostedEvent } from "@/lib/api/events"
import {
  MAP_STRIP_PX,
  PEEK_CONTENT_PX,
  coverOf,
  drawerSnapPoints,
  pinEventFromHosted,
  snapAt,
  snapIndex,
} from "./flare-drawer"

describe("drawerSnapPoints (#615)", () => {
  it("is peek over the nav, about half the screen, and full minus the map strip", () => {
    expect(drawerSnapPoints(844, 68)).toEqual([
      `${68 + PEEK_CONTENT_PX}px`,
      `${Math.round(844 * 0.55)}px`,
      `${844 - MAP_STRIP_PX}px`,
    ])
  })

  it("stays increasing on a short screen", () => {
    const points = drawerSnapPoints(420, 68).map(coverOf)
    expect(points[0]).toBeLessThan(points[1])
    expect(points[1]).toBeLessThan(points[2])
  })
})

describe("coverOf", () => {
  it("reads a px snap point and treats anything else as uncovered", () => {
    expect(coverOf("244px")).toBe(244)
    expect(coverOf(null)).toBe(0)
    expect(coverOf(0.5)).toBe(0)
  })
})

describe("snapAt / snapIndex", () => {
  it("round-trips and clamps", () => {
    expect(snapAt(snapIndex("full"))).toBe("full")
    expect(snapAt(-1)).toBe("peek")
    expect(snapAt(9)).toBe("full")
  })
})

describe("pinEventFromHosted", () => {
  it("gives the map a pin and a route target in its own [lng, lat] order", () => {
    const pin = pinEventFromHosted({
      id: "e1",
      hostId: "h1",
      hostName: "Lina",
      title: "drinks",
      type: "drinks",
      startAt: "2026-10-19T18:00:00.000Z",
      endAt: "2026-10-19T22:00:00.000Z",
      locationLabel: "klunkerkranich",
      coordinates: { lat: 52.48, lng: 13.43 },
      visibility: "private",
      attendingCount: 3,
      myRsvp: "going",
    } as HostedEvent)
    expect(pin.location).toEqual({
      name: "klunkerkranich",
      address: undefined,
      coordinates: [13.43, 52.48],
    })
    expect(pin.host.name).toBe("Lina")
    expect(pin.going).toBe(3)
    expect(pin.myRsvp).toBe("going")
  })
})

describe("flareDrawerPath", () => {
  it("opens the drawer, carrying the old page's tab and composer links", async () => {
    const { flareDrawerPath } = await import("./shared-flare")
    expect(flareDrawerPath("abc")).toBe("/?flare=abc")
    expect(
      flareDrawerPath("abc", {
        search: "?tab=updates&compose=1&x=y",
        back: true,
      })
    ).toBe("/?flare=abc&tab=updates&compose=1&back=1")
  })
})
