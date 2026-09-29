import { describe, expect, it } from "vitest"
import { resolveSiteUrl } from "./site-url"

describe("resolveSiteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL as-is when it already has a scheme", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://sponti.fun" })).toBe(
      "https://sponti.fun",
    )
  })

  it("adds https:// to NEXT_PUBLIC_SITE_URL when no scheme is given", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "sponti.fun" })).toBe(
      "https://sponti.fun",
    )
  })

  it("strips a trailing slash from NEXT_PUBLIC_SITE_URL", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://sponti.fun/" })).toBe(
      "https://sponti.fun",
    )
  })

  it("falls back to VERCEL_PROJECT_PRODUCTION_URL when no override is set", () => {
    expect(
      resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "sponti-flame.vercel.app" }),
    ).toBe("https://sponti-flame.vercel.app")
  })

  it("prefers NEXT_PUBLIC_SITE_URL over VERCEL_PROJECT_PRODUCTION_URL", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://sponti.fun",
        VERCEL_PROJECT_PRODUCTION_URL: "sponti-flame.vercel.app",
      }),
    ).toBe("https://sponti.fun")
  })

  it("falls back to VERCEL_URL when the production URL isn't set", () => {
    expect(
      resolveSiteUrl({ VERCEL_URL: "sponti-flame-git-preview.vercel.app" }),
    ).toBe("https://sponti-flame-git-preview.vercel.app")
  })

  it("prefers VERCEL_PROJECT_PRODUCTION_URL over VERCEL_URL", () => {
    expect(
      resolveSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "sponti-flame.vercel.app",
        VERCEL_URL: "sponti-flame-git-preview.vercel.app",
      }),
    ).toBe("https://sponti-flame.vercel.app")
  })

  it("falls back to localhost when nothing is set", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000")
  })

  it("ignores blank env values and keeps falling back", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "   ",
        VERCEL_PROJECT_PRODUCTION_URL: "sponti-flame.vercel.app",
      }),
    ).toBe("https://sponti-flame.vercel.app")
  })
})
