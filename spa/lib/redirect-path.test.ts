import { describe, expect, it } from "vitest"
import { buildLoginPath, getSafeRedirectPath } from "./redirect-path"

describe("getSafeRedirectPath (#219)", () => {
  it.each([
    ["/event/event-1", "/event/event-1"],
    ["/event/event-1?from=share", "/event/event-1?from=share"],
    ["/circles#top", "/circles#top"],
    ["/qr/abc%20def", "/qr/abc%20def"],
  ])("keeps the in-app path %s", (value, expected) => {
    expect(getSafeRedirectPath(value)).toBe(expected)
  })

  it.each([
    null,
    undefined,
    "",
    "event/event-1",
    "https://evil.com",
    "javascript:alert(1)",
    "//evil.com",
    "//evil.com/event/1",
    "/\\evil.com",
    "/\tevil.com",
    "/login",
    "/login?redirectTo=%2Fcircles",
    "/register",
    "/forgot-password",
    "/reset-password",
  ])("rejects %s", (value) => {
    expect(getSafeRedirectPath(value)).toBe("/")
  })
})

describe("buildLoginPath (#219)", () => {
  it("carries the original path and query", () => {
    expect(buildLoginPath("/event/event-1?from=share")).toBe(
      "/login?redirectTo=%2Fevent%2Fevent-1%3Ffrom%3Dshare"
    )
  })

  it("uses a bare /login for the home screen", () => {
    expect(buildLoginPath("/")).toBe("/login")
  })
})
