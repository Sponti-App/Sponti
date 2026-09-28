import { afterEach, describe, expect, it, vi } from "vitest"

// #212: auth and api sleep independently on Render's free tier, so the auth
// screens ping both `/health` endpoints on mount to start waking them before
// the user submits.

const AUTH_BASE = "https://auth.test"
const API_BASE = "https://api.test"

async function loadHttp() {
  vi.stubEnv("NEXT_PUBLIC_AUTH_BASE_URL", AUTH_BASE)
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE)
  vi.resetModules()
  return import("./http")
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("warmBackends", () => {
  it("pings both services' /health once per page load", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const { warmBackends } = await loadHttp()

    warmBackends()
    warmBackends()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(`${AUTH_BASE}/health`, {
      mode: "no-cors",
    })
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/health`, {
      mode: "no-cors",
    })
  })

  it("swallows network failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    vi.stubGlobal("fetch", fetchMock)
    const { warmBackends } = await loadHttp()

    expect(() => warmBackends()).not.toThrow()
    // Let the rejected promises settle; an unhandled rejection fails the run.
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
