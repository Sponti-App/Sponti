import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildFlareInviteUrl,
  flareInviteMessage,
  flareInvitePath,
  inviteWhen,
  isFlareInvitePath,
  parseFlareInvitePath,
} from "./flare-invite-links"
import { buildRegisterPath } from "./contact-links"
import { getSafeRedirectPath } from "./redirect-path"

describe("flare invite links (#616)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds and parses the path, with or without 'i'm in'", () => {
    expect(flareInvitePath("abc_DEF-123")).toBe("/f/abc_DEF-123")
    expect(flareInvitePath("abc", { redeem: true })).toBe("/f/abc?in=1")
    expect(parseFlareInvitePath("/f/abc_DEF-123")).toEqual({
      token: "abc_DEF-123",
      redeem: false,
    })
    expect(parseFlareInvitePath("/f/abc?in=1")).toEqual({
      token: "abc",
      redeem: true,
    })
    expect(parseFlareInvitePath("/f/abc?in=0#x")).toEqual({
      token: "abc",
      redeem: false,
    })
  })

  it.each([
    null,
    "/",
    "/invite/abc",
    "/f/",
    "/f/a/b",
    "/f/%3Cscript%3E",
    "/f/%E0%A4%A",
  ])("ignores %s", (path) => {
    expect(parseFlareInvitePath(path)).toBeNull()
  })

  it("is a public path only under /f/", () => {
    expect(isFlareInvitePath("/f/abc")).toBe(true)
    expect(isFlareInvitePath("/flare")).toBe(false)
    expect(isFlareInvitePath("/event/abc")).toBe(false)
  })

  it("survives the sign-up round trip with 'i'm in' kept", () => {
    const path = buildRegisterPath(flareInvitePath("abc", { redeem: true }))
    expect(path).toBe("/register?redirectTo=%2Ff%2Fabc%3Fin%3D1")
    const target = new URL(path, "http://x").searchParams.get("redirectTo")
    expect(getSafeRedirectPath(target)).toBe("/f/abc?in=1")
    expect(parseFlareInvitePath(getSafeRedirectPath(target))).toEqual({
      token: "abc",
      redeem: true,
    })
  })

  it("builds the shared link on NEXT_PUBLIC_SITE_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "app.sponti.fun/")
    expect(buildFlareInviteUrl("abc")).toBe("https://app.sponti.fun/f/abc")
  })

  describe("when", () => {
    const now = new Date(2026, 9, 21, 18, 0).getTime() // wed 6pm
    const at = (day: number, hour: number) =>
      new Date(2026, 9, day, hour, 0).toISOString()

    it("says now while it is on", () => {
      expect(inviteWhen({ startAt: at(21, 17), endAt: at(21, 20) }, now)).toBe(
        "now"
      )
    })

    it("says today for later today", () => {
      expect(
        inviteWhen({ startAt: at(21, 19), endAt: at(21, 22) }, now)
      ).toMatch(/^today /)
    })

    it("says the weekday, date and time another day, in lowercase", () => {
      const when = inviteWhen({ startAt: at(24, 19), endAt: at(24, 22) }, now)
      expect(when).toBe(when.toLowerCase())
      expect(when).toMatch(/^sat, /)
      expect(when).toContain("24")
    })
  })

  describe("the share message", () => {
    const now = new Date(2026, 9, 21, 18, 0).getTime()
    const startAt = new Date(2026, 9, 24, 19, 0).toISOString()
    const endAt = new Date(2026, 9, 24, 22, 0).toISOString()

    it("is '<Host> invited you to <title> on <weekday, date> at <time>'", () => {
      expect(
        flareInviteMessage({
          hostName: "Patrick Caire",
          title: "drinks at klunkerkranich",
          type: "drinks",
          startAt,
          endAt,
          now,
        })
      ).toMatch(
        /^Patrick invited you to drinks at klunkerkranich on Saturday, October 24 at 7:00\sPM$/
      )
    })

    it("keeps the host's own title as they typed it", () => {
      expect(
        flareInviteMessage({
          hostName: "Patrick",
          title: "Anna's Birthday",
          type: "party",
          startAt,
          endAt,
          now,
        })
      ).toContain("invited you to Anna's Birthday on ")
    })

    it("names an untitled flare by its category, without the host twice", () => {
      expect(
        flareInviteMessage({
          hostName: "Patrick",
          title: "drinks",
          type: "drinks",
          startAt,
          endAt,
          now,
        })
      ).toMatch(/^Patrick invited you to drinks on /)
    })

    it("still reads when the host's name is unknown", () => {
      expect(
        flareInviteMessage({
          hostName: null,
          title: "drinks",
          type: "drinks",
          startAt,
          endAt,
          now,
        })
      ).toMatch(/^You're invited to drinks on /)
    })

    it("says when the flare is on right now", () => {
      expect(
        flareInviteMessage({
          hostName: "Patrick",
          title: "drinks",
          type: "drinks",
          startAt: new Date(2026, 9, 21, 17, 0).toISOString(),
          endAt,
          now,
        })
      ).toBe("Patrick invited you to drinks, happening now")
    })
  })
})
