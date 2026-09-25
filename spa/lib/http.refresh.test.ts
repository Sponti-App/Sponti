import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "./auth-store"

// #167: several requests can race a 401 at once (the access token expires
// every 15 minutes and several screens poll in parallel). The auth-server
// uses single-use refresh tokens, so every concurrent refresh but the first
// used to fail — and `refreshSession()` cleared the session on *any*
// non-OK response, including a 5xx, logging testers out for no real reason.

const USER: AuthUser = {
  id: "u1",
  username: "flaretester",
  displayName: "Flare Tester",
  email: "flaretester@sponti.test",
  profileVisibility: "public",
  socialBattery: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const AUTH_BASE = "https://auth.test"
const API_BASE = "https://api.test"
const REFRESH_URL = `${AUTH_BASE}/auth/refresh`

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function authHeader(init: RequestInit | undefined): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined
  return headers?.Authorization
}

// http.ts and auth-store.ts read env vars and localStorage at module load, so
// each test gets a fresh module graph under a clean env/store (matches the
// pattern in use-events.test.tsx).
async function loadHttp() {
  vi.stubEnv("NEXT_PUBLIC_AUTH_BASE_URL", AUTH_BASE)
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE)
  vi.resetModules()
  const http = await import("./http")
  const authStore = await import("./auth-store")
  return { http, authStore }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("concurrent 401s share one refresh (#167)", () => {
  it("makes exactly one /auth/refresh call and doesn't log the user out", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("old-access", "old-refresh", USER)

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        return jsonResponse(
          { accessToken: "new-access", refreshToken: "new-refresh" },
          200
        )
      }
      if (authHeader(init) === "Bearer old-access") {
        return jsonResponse({ message: "jwt expired" }, 401)
      }
      return jsonResponse({ ok: true }, 200)
    })
    vi.stubGlobal("fetch", fetchMock)

    const results = await Promise.all([
      http.apiFetch("/a"),
      http.apiFetch("/b"),
      http.apiFetch("/c"),
    ])

    const refreshCalls = fetchMock.mock.calls.filter(
      ([url]) => url === REFRESH_URL
    )
    expect(refreshCalls).toHaveLength(1)
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])

    // Every retried request used the new token, and the session reflects it.
    expect(authStore.getToken()).toBe("new-access")
    expect(authStore.getRefreshToken()).toBe("new-refresh")
  })
})

describe("a failed refresh keeps the session (#167)", () => {
  it("doesn't clear the session on a 500 from /auth/refresh", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("old-access", "old-refresh", USER)

    const fetchMock = vi.fn(async (url: string) => {
      if (url === REFRESH_URL) {
        return jsonResponse({ message: "Internal server error" }, 500)
      }
      return jsonResponse({ message: "jwt expired" }, 401)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(http.apiFetch("/a")).rejects.toMatchObject({
      code: "SESSION_REFRESH_FAILED",
    })

    // The refresh token is still good — a transient server error must not
    // sign the user out.
    expect(authStore.getToken()).toBe("old-access")
    expect(authStore.getRefreshToken()).toBe("old-refresh")
    expect(authStore.getUser()).toEqual(USER)
  })

  it("doesn't clear the session on a network error from /auth/refresh", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("old-access", "old-refresh", USER)

    const fetchMock = vi.fn(async (url: string) => {
      if (url === REFRESH_URL) {
        throw new TypeError("Failed to fetch")
      }
      return jsonResponse({ message: "jwt expired" }, 401)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(http.apiFetch("/a")).rejects.toMatchObject({
      code: "SESSION_REFRESH_FAILED",
    })

    expect(authStore.getToken()).toBe("old-access")
    expect(authStore.getRefreshToken()).toBe("old-refresh")
  })

  it("still clears the session when the server says the refresh token is invalid", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("old-access", "old-refresh", USER)

    const fetchMock = vi.fn(async (url: string) => {
      if (url === REFRESH_URL) {
        return jsonResponse({ message: "Invalid refresh token" }, 401)
      }
      return jsonResponse({ message: "jwt expired" }, 401)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(http.apiFetch("/a")).rejects.toBeTruthy()

    expect(authStore.getToken()).toBeNull()
    expect(authStore.getRefreshToken()).toBeNull()
  })
})

describe("multi-tab refresh race (#167)", () => {
  it("reuses a pair another tab already rotated instead of spending another refresh call", async () => {
    const { http, authStore } = await loadHttp()
    authStore.setSession("old-access", "old-refresh", USER)

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === REFRESH_URL) {
        throw new Error(
          "should not call /auth/refresh once another tab already rotated the pair"
        )
      }
      if (authHeader(init) === "Bearer old-access") {
        // Simulate another tab's refresh landing in localStorage right as
        // this request's 401 comes back — same effect a native `storage`
        // event would have, one tab over.
        authStore.setSession("other-tab-access", "other-tab-refresh", USER)
        return jsonResponse({ message: "jwt expired" }, 401)
      }
      if (authHeader(init) === "Bearer other-tab-access") {
        return jsonResponse({ ok: true }, 200)
      }
      return jsonResponse({ message: "unexpected" }, 401)
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await http.apiFetch("/a")

    expect(result).toEqual({ ok: true })
    expect(fetchMock.mock.calls.some(([url]) => url === REFRESH_URL)).toBe(
      false
    )
    expect(authStore.getToken()).toBe("other-tab-access")
  })
})
