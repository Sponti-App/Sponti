// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
  // The bundled docs call it unstable_doesProxyMatch; this Next exports the
  // older name.
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server"
import { config, proxy } from "./proxy"

// #467: proxy.ts wired to lib/landing-host.ts (whose rules have their own
// tests), and the matcher that decides which requests reach it at all.

const request = (url: string) => new NextRequest(url)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("proxy (#467)", () => {
  it("passes everything through without the env", () => {
    vi.stubEnv("LANDING_HOSTS", "")
    vi.stubEnv("APP_ORIGIN", "")
    const response = proxy(request("https://sponti.fun/invite/abc"))
    expect(isRewrite(response)).toBe(false)
    expect(getRedirectUrl(response)).toBeNull()
  })

  describe("with LANDING_HOSTS and APP_ORIGIN", () => {
    const configure = () => {
      vi.stubEnv("LANDING_HOSTS", "sponti.fun,www.sponti.fun")
      vi.stubEnv("APP_ORIGIN", "https://app.sponti.fun")
    }

    it("rewrites the landing host's / to /landing", () => {
      configure()
      const response = proxy(request("https://sponti.fun/"))
      expect(isRewrite(response)).toBe(true)
      expect(getRewrittenUrl(response)).toBe("https://sponti.fun/landing")
    })

    it("serves the legal pages on the landing host", () => {
      configure()
      const response = proxy(request("https://www.sponti.fun/menu/impressum"))
      expect(isRewrite(response)).toBe(false)
      expect(getRedirectUrl(response)).toBeNull()
    })

    it("redirects other paths to the app with path and query", () => {
      configure()
      const response = proxy(request("https://sponti.fun/invite/abc?x=1"))
      expect(response.status).toBe(307)
      expect(getRedirectUrl(response)).toBe(
        "https://app.sponti.fun/invite/abc?x=1"
      )
    })

    it("leaves the app host alone", () => {
      configure()
      const response = proxy(request("https://app.sponti.fun/"))
      expect(isRewrite(response)).toBe(false)
      expect(getRedirectUrl(response)).toBeNull()
    })
  })
})

describe("proxy matcher", () => {
  const matches = (url: string) =>
    unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })

  it("runs on pages, including dotted usernames and preview images", () => {
    for (const url of [
      "/",
      "/landing",
      "/invite/abc",
      "/menu/impressum",
      "/profile/jo.doe",
      "/opengraph-image",
    ]) {
      expect(matches(url), url).toBe(true)
    }
  })

  it("skips Next's files, the api routes and static files", () => {
    for (const url of [
      "/_next/static/chunks/main.js",
      "/_next/image?url=x",
      "/api/places",
      "/favicon.ico",
      "/apple-icon.png",
      "/manifest.webmanifest",
    ]) {
      expect(matches(url), url).toBe(false)
    }
  })
})
