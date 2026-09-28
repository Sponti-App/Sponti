import { describe, expect, it } from "vitest"
import {
  etaAvailable,
  flareStatusLine,
  flareTiming,
  flareViewer,
  googleMapsUrl,
  ownArrivalLabel,
  shouldDrawRoute,
  spotsLeftLabel,
} from "./flare-detail"

const MIN = 60_000
const NOW = Date.parse("2026-09-28T18:00:00.000Z")
const at = (offsetMin: number) => new Date(NOW + offsetMin * MIN).toISOString()

describe("flareViewer", () => {
  it("is host for the host, whatever their rsvp", () => {
    expect(flareViewer({ isHost: true, myRsvp: "going" })).toBe("host")
  })

  it("is joined only for a going guest", () => {
    expect(flareViewer({ isHost: false, myRsvp: "going" })).toBe("joined")
    expect(flareViewer({ isHost: false, myRsvp: "invited" })).toBe("invited")
    expect(flareViewer({ isHost: false, myRsvp: "declined" })).toBe("invited")
    expect(flareViewer({ isHost: false, myRsvp: null })).toBe("invited")
  })
})

describe("flareTiming and the ETA window", () => {
  it("is live between start and end", () => {
    expect(flareTiming({ startAt: at(-10), endAt: at(60) }, NOW)).toBe("live")
  })

  it("is soon when it starts within the next hour, later beyond that", () => {
    expect(flareTiming({ startAt: at(60), endAt: at(120) }, NOW)).toBe("soon")
    expect(flareTiming({ startAt: at(61), endAt: at(120) }, NOW)).toBe("later")
  })

  it("is ended after the end, and cancelled wins over everything", () => {
    expect(flareTiming({ startAt: at(-120), endAt: at(-1) }, NOW)).toBe("ended")
    expect(
      flareTiming({ startAt: at(-10), endAt: at(60), cancelled: true }, NOW)
    ).toBe("cancelled")
  })

  it("only offers an ETA when live or starting within 1h", () => {
    expect(etaAvailable("live")).toBe(true)
    expect(etaAvailable("soon")).toBe(true)
    expect(etaAvailable("later")).toBe(false)
    expect(etaAvailable("ended")).toBe(false)
    expect(etaAvailable("cancelled")).toBe(false)
  })
})

describe("shouldDrawRoute", () => {
  it("draws the route within 2 km", () => {
    expect(shouldDrawRoute({ viewer: "joined", distanceMeters: 1_999 })).toBe(true)
    expect(shouldDrawRoute({ viewer: "invited", distanceMeters: 2_000 })).toBe(true)
  })

  it("doesn't draw it beyond 2 km or without a location", () => {
    expect(shouldDrawRoute({ viewer: "joined", distanceMeters: 2_001 })).toBe(false)
    expect(shouldDrawRoute({ viewer: "joined", distanceMeters: null })).toBe(false)
  })

  it("never draws it for the host", () => {
    expect(shouldDrawRoute({ viewer: "host", distanceMeters: 10 })).toBe(false)
  })
})

describe("googleMapsUrl", () => {
  it("opens Google Maps at the flare's coordinates", () => {
    expect(
      googleMapsUrl({ coordinates: { lat: 53.55, lng: 9.99 }, name: "the harp" })
    ).toBe("https://www.google.com/maps/search/?api=1&query=53.55%2C9.99")
  })

  it("searches for the place name when there are no coordinates", () => {
    expect(googleMapsUrl({ name: "the harp, 47 chandos pl" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=the%20harp%2C%2047%20chandos%20pl"
    )
  })
})

describe("flareStatusLine", () => {
  it("counts down to the end while live", () => {
    expect(
      flareStatusLine({ startAt: at(-10), endAt: at(95) }, "live", NOW)
    ).toBe("live · ends in 1h 35m")
  })

  it("counts down to the start before it", () => {
    expect(
      flareStatusLine({ startAt: at(40), endAt: at(160) }, "soon", NOW)
    ).toBe("starts in 40 min")
    expect(
      flareStatusLine({ startAt: at(3 * 24 * 60), endAt: at(3 * 24 * 60 + 60) }, "later", NOW)
    ).toBe("starts in 3 days")
  })
})

describe("spotsLeftLabel (#181)", () => {
  it("is exact while the limit is enforced", () => {
    expect(
      spotsLeftLabel({ visibility: "public", guestLimit: 8, headcount: 5, allowGuestInvites: "none" })
    ).toBe("3 spots left · 8 max")
  })

  it("is approximate once +1/re-share is on", () => {
    expect(
      spotsLeftLabel({ visibility: "public", guestLimit: 8, headcount: 7, allowGuestInvites: "single" })
    ).toBe("about 1 spot left · 8 max")
  })

  it("says full at the limit", () => {
    expect(
      spotsLeftLabel({ visibility: "public", guestLimit: 2, headcount: 2, allowGuestInvites: "none" })
    ).toBe("full · 2 max")
  })

  it("never shows a limit on a private flare", () => {
    expect(
      spotsLeftLabel({ visibility: "private", guestLimit: 10, headcount: 1, allowGuestInvites: "none" })
    ).toBeNull()
  })
})

describe("ownArrivalLabel", () => {
  it("reads as the viewer's own plan", () => {
    expect(ownArrivalLabel(at(15), NOW)).toBe("you're arriving in 15 min")
    expect(ownArrivalLabel(at(-1), NOW)).toBe("you should be there")
    expect(ownArrivalLabel(at(60), NOW)).toBe("you're arriving in about 1 hr")
  })
})
