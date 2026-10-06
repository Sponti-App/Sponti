import { describe, expect, it } from "vitest"
import {
  landingAppUrl,
  normalizeHost,
  parseAppOrigin,
  parseLandingHosts,
  routeLandingHost,
} from "@/lib/landing-host"

const ENV = {
  LANDING_HOSTS: "sponti.fun, www.sponti.fun",
  APP_ORIGIN: "https://app.sponti.fun",
}

const route = (
  host: string,
  pathname: string,
  search = "",
  env: Parameters<typeof routeLandingHost>[0]["env"] = ENV
) => routeLandingHost({ host, pathname, search, env })

describe("routeLandingHost (#467)", () => {
  it("rewrites the landing host's / to the landing route", () => {
    expect(route("sponti.fun", "/")).toEqual({
      action: "rewrite",
      pathname: "/landing",
    })
    expect(route("www.sponti.fun", "/")).toEqual({
      action: "rewrite",
      pathname: "/landing",
    })
  })

  it("matches the host without case, port or trailing dot", () => {
    expect(route("Sponti.FUN:443", "/").action).toBe("rewrite")
    expect(route("sponti.fun.", "/").action).toBe("rewrite")
  })

  it("serves the legal pages on the landing host", () => {
    for (const path of ["/menu/impressum", "/menu/privacy", "/menu/terms"]) {
      expect(route("sponti.fun", path)).toEqual({ action: "next" })
      expect(route("sponti.fun", `${path}/`)).toEqual({ action: "next" })
    }
  })

  it("serves the link-preview images on the landing host", () => {
    expect(route("sponti.fun", "/opengraph-image")).toEqual({
      action: "next",
    })
    expect(route("sponti.fun", "/twitter-image")).toEqual({ action: "next" })
  })

  it("redirects every other path to the app, keeping path and query", () => {
    expect(route("sponti.fun", "/invite/abc_123", "?ref=chat&x=1")).toEqual({
      action: "redirect",
      url: "https://app.sponti.fun/invite/abc_123?ref=chat&x=1",
    })
    expect(route("sponti.fun", "/login")).toEqual({
      action: "redirect",
      url: "https://app.sponti.fun/login",
    })
    expect(route("sponti.fun", "/menu")).toEqual({
      action: "redirect",
      url: "https://app.sponti.fun/menu",
    })
  })

  it("also serves /landing itself on the landing host", () => {
    expect(route("sponti.fun", "/landing", "?a=1")).toEqual({ action: "next" })
  })

  it("leaves every other host alone", () => {
    expect(route("app.sponti.fun", "/")).toEqual({ action: "next" })
    expect(route("app.sponti.fun", "/invite/abc")).toEqual({ action: "next" })
    expect(route("sponti-flame.vercel.app", "/login")).toEqual({
      action: "next",
    })
    expect(route("localhost:3000", "/landing")).toEqual({ action: "next" })
  })

  it("changes nothing without the env", () => {
    for (const env of [
      {},
      { LANDING_HOSTS: "sponti.fun" },
      { APP_ORIGIN: "https://app.sponti.fun" },
      { LANDING_HOSTS: " , ", APP_ORIGIN: "https://app.sponti.fun" },
      { LANDING_HOSTS: "sponti.fun", APP_ORIGIN: "not a url" },
      { LANDING_HOSTS: "sponti.fun", APP_ORIGIN: "ftp://app.sponti.fun" },
    ]) {
      expect(route("sponti.fun", "/", "", env)).toEqual({ action: "next" })
      expect(route("sponti.fun", "/invite/abc", "", env)).toEqual({
        action: "next",
      })
    }
  })

  it("does nothing when the app origin is itself a landing host (a loop)", () => {
    const env = {
      LANDING_HOSTS: "sponti.fun",
      APP_ORIGIN: "https://sponti.fun",
    }
    expect(route("sponti.fun", "/login", "", env)).toEqual({ action: "next" })
  })
})

describe("parsers", () => {
  it("parseLandingHosts splits, trims and lowercases", () => {
    expect(parseLandingHosts(" Sponti.fun ,www.sponti.fun,, ")).toEqual([
      "sponti.fun",
      "www.sponti.fun",
    ])
    expect(parseLandingHosts(undefined)).toEqual([])
  })

  it("parseAppOrigin keeps only the origin and adds https to a bare host", () => {
    expect(parseAppOrigin("https://app.sponti.fun/")).toBe(
      "https://app.sponti.fun"
    )
    expect(parseAppOrigin("app.sponti.fun")).toBe("https://app.sponti.fun")
    expect(parseAppOrigin("http://127.0.0.1:4415/x")).toBe(
      "http://127.0.0.1:4415"
    )
    expect(parseAppOrigin("")).toBeNull()
    expect(parseAppOrigin(undefined)).toBeNull()
  })

  it("normalizeHost", () => {
    expect(normalizeHost("WWW.Sponti.fun:8080")).toBe("www.sponti.fun")
    expect(normalizeHost(null)).toBe("")
  })
})

describe("landingAppUrl", () => {
  it("prefers APP_ORIGIN, then NEXT_PUBLIC_SITE_URL, then this origin", () => {
    expect(
      landingAppUrl({
        APP_ORIGIN: "https://app.sponti.fun",
        NEXT_PUBLIC_SITE_URL: "https://other.example",
      })
    ).toBe("https://app.sponti.fun/")
    expect(landingAppUrl({ NEXT_PUBLIC_SITE_URL: "app.sponti.fun/" })).toBe(
      "https://app.sponti.fun/"
    )
    expect(landingAppUrl({})).toBe("/")
  })
})
