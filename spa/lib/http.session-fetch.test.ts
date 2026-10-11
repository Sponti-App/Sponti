import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "./auth-store"

// #541: the SPA's own Google proxy routes need the access token. sessionFetch
// sends it and, on a 401, refreshes the session once like authFetch does.

const USER: AuthUser = {
  id: "u1",
  username: "flaretester",
  displayName: "Flare Tester",
  email: "flaretester@sponti.test",
  profileVisibility: "public",
  socialBattery: 100,
  bio: null,
  instagram: null,
  telegram: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const AUTH_BASE = "https://auth.test"
const REFRESH_URL = `${AUTH_BASE}/auth/refresh`

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const bearer = (init: RequestInit | undefined) =>
  new Headers(init?.headers).get("Authorization")

async function loadHttp() {
  vi.stubEnv("NEXT_PUBLIC_AUTH_BASE_URL", AUTH_BASE)
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test")
  vi.resetModules()
  const http = await import("./http")
  const authStore = await import("./auth-store")
  return { http, authStore }
}

beforeEach(() => window.localStorage.clear())

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("sessionFetch", () => {
  it("sends the access token and passes the request options through", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("access", "refresh", USER)
    const fetchMock = vi.fn(async () => json({ ok: true }, 200))
    vi.stubGlobal("fetch", fetchMock)
    const signal = new AbortController().signal

    const res = await http.sessionFetch("/api/places?input=cafe", { signal })

    expect(res.status).toBe(200)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("/api/places?input=cafe")
    expect(bearer(init)).toBe("Bearer access")
    expect(init.signal).toBe(signal)
  })

  it("refreshes once on a 401 and retries with the new token", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("old-access", "old-refresh", USER)
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        return json({ accessToken: "new-access", refreshToken: "new-r" }, 200)
      }
      return bearer(init) === "Bearer new-access"
        ? json({ ok: true }, 200)
        : json({ error: "sign in to use this" }, 401)
    })
    vi.stubGlobal("fetch", fetchMock)

    const res = await http.sessionFetch("/api/geocode?lat=1&lng=2")

    expect(res.status).toBe(200)
    expect(
      fetchMock.mock.calls.filter(([u]) => u === REFRESH_URL)
    ).toHaveLength(1)
  })

  it("returns the 401 when the session cannot be refreshed", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("old-access", "old-refresh", USER)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "no" }, 401))
    )

    const res = await http.sessionFetch("/api/places?input=cafe")

    expect(res.status).toBe(401)
  })

  it("does not try to refresh when signed out", async () => {
    const { http } = await loadHttp()
    const fetchMock = vi.fn(async () => json({ error: "no" }, 401))
    vi.stubGlobal("fetch", fetchMock)

    const res = await http.sessionFetch("/api/places?input=cafe")

    expect(res.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
