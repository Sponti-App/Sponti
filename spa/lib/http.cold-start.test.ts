import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// #171: a cold Render free-tier instance can take 30-60s to answer the
// first request after being idle. The client used a flat ~12s timeout, so
// the first sign-in or map load after idle surfaced a timeout error instead
// of just waiting a bit longer.

const AUTH_BASE = "https://auth.test"
const API_BASE = "https://api.test"

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// A fetch mock that never settles on its own — it only rejects once the
// AbortSignal request() attaches actually fires, exactly like a real fetch
// against a server that's still waking up.
function hangUntilAborted(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("The operation was aborted.", "AbortError"))
    })
  })
}

async function loadHttp() {
  vi.stubEnv("NEXT_PUBLIC_AUTH_BASE_URL", AUTH_BASE)
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API_BASE)
  vi.resetModules()
  return import("./http")
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("cold-start tolerance for GET requests (#171)", () => {
  it("retries a timed-out GET once with a longer window and succeeds", async () => {
    const http = await loadHttp()

    let calls = 0
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      calls += 1
      if (calls === 1) return hangUntilAborted(init)
      return Promise.resolve(jsonResponse({ ok: true }, 200))
    })
    vi.stubGlobal("fetch", fetchMock)

    // A short timeoutMs here stands in for the cold-start wait — the retry
    // itself always uses the longer COLD_START_TIMEOUT_MS window.
    const result = await http.apiFetch<{ ok: boolean }>("/a", {
      timeoutMs: 20,
    })

    expect(result).toEqual({ ok: true })
    expect(calls).toBe(2)
  })

  it("still surfaces a timeout if the retry also times out", async () => {
    const http = await loadHttp()

    let calls = 0
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      calls += 1
      return hangUntilAborted(init)
    })
    vi.stubGlobal("fetch", fetchMock)

    // The retry always uses the full COLD_START_TIMEOUT_MS window, so fake
    // timers stand in for the ~45s real wait.
    vi.useFakeTimers()
    const pending = expect(
      http.apiFetch("/a", { timeoutMs: 20 })
    ).rejects.toMatchObject({
      message: expect.stringContaining("timed out"),
    })

    await vi.advanceTimersByTimeAsync(20) // first attempt times out
    await vi.advanceTimersByTimeAsync(http.COLD_START_TIMEOUT_MS) // retry too

    await pending
    // Exactly one retry, not an unbounded loop.
    expect(calls).toBe(2)
  })
})

describe("no blind retry for non-idempotent requests (#171)", () => {
  it("does not retry a timed-out POST", async () => {
    const http = await loadHttp()

    let calls = 0
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      calls += 1
      return hangUntilAborted(init)
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      http.authFetch("/auth/login", {
        method: "POST",
        body: { email: "a@b.com", password: "hunter2hunter2" },
        timeoutMs: 20,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining("timed out"),
    })

    expect(calls).toBe(1)
  })
})
