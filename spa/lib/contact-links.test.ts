import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildContactUrl,
  buildRegisterPath,
  isContactPath,
  parseContactPath,
} from "./contact-links"
import { getSafeRedirectPath } from "./redirect-path"

describe("contact links (#124)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ["/qr/abc_DEF-123", { kind: "qr", token: "abc_DEF-123" }],
    ["/invite/abc123", { kind: "invite", token: "abc123" }],
    ["/invite/abc123?x=1", { kind: "invite", token: "abc123" }],
  ])("parses %s", (path, expected) => {
    expect(parseContactPath(path)).toEqual(expected)
  })

  it.each([
    null,
    "/",
    "/circles",
    "/qr/",
    "/invite/a/b",
    "/invite/%3Cscript%3E",
    "/invite/%E0%A4%A",
  ])("ignores %s", (path) => {
    expect(parseContactPath(path)).toBeNull()
  })

  it("recognises both link kinds as public paths", () => {
    expect(isContactPath("/qr/x")).toBe(true)
    expect(isContactPath("/invite/x")).toBe(true)
    expect(isContactPath("/circles")).toBe(false)
  })

  it("sends signed-out visitors to sign-up with a safe return path", () => {
    const path = buildRegisterPath("/invite/abc123")
    expect(path).toBe("/register?redirectTo=%2Finvite%2Fabc123")
    // What the register page reads back from that URL.
    const target = new URL(path, "http://x").searchParams.get("redirectTo")
    expect(getSafeRedirectPath(target)).toBe("/invite/abc123")
    expect(buildRegisterPath("//evil.com")).toBe("/register")
  })

  it("builds links on NEXT_PUBLIC_SITE_URL when set, else this origin", () => {
    expect(buildContactUrl("qr", "t1")).toBe(`${window.location.origin}/qr/t1`)
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "sponti-flame.vercel.app/")
    expect(buildContactUrl("invite", "t2")).toBe(
      "https://sponti-flame.vercel.app/invite/t2"
    )
  })
})
