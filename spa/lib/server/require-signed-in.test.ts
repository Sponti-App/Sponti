// @vitest-environment node
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  SIGNED_IN_CACHE_MS,
  USER_LIMIT_MAX,
  USER_LIMIT_WINDOW_MS,
  requireSignedIn,
  resetSignedInState,
} from "./require-signed-in"

const request = (token?: string) =>
  new NextRequest("https://app.test/api/places?input=cafe", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

const meResponse = (id = "user-1") =>
  new Response(JSON.stringify({ user: { id } }), { status: 200 })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetSignedInState()
  vi.stubEnv("NEXT_PUBLIC_AUTH_BASE_URL", "/proxy/auth, https://auth.test/")
  fetchMock = vi.fn(async () => meResponse())
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("requireSignedIn", () => {
  it("refuses a request without a token and never calls the auth-server", async () => {
    expect(await requireSignedIn(request())).toMatchObject({
      ok: false,
      status: 401,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses an empty bearer token", async () => {
    const req = new NextRequest("https://app.test/api/places", {
      headers: { authorization: "Bearer " },
    })
    expect(await requireSignedIn(req)).toMatchObject({ status: 401 })
  })

  it("asks the auth-server's absolute URL who the token belongs to", async () => {
    expect(await requireSignedIn(request("tok"))).toEqual({
      ok: true,
      userId: "user-1",
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://auth.test/auth/me")
    expect(init.headers).toEqual({ Authorization: "Bearer tok" })
  })

  it("refuses a token the auth-server rejects", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }))
    expect(await requireSignedIn(request("forged"))).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it("does not cache a rejected token", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }))
    await requireSignedIn(request("tok"))
    expect(await requireSignedIn(request("tok"))).toMatchObject({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("answers 503 when the auth-server is unreachable or broken", async () => {
    fetchMock.mockRejectedValueOnce(new Error("down"))
    expect(await requireSignedIn(request("a"))).toMatchObject({ status: 503 })
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }))
    expect(await requireSignedIn(request("b"))).toMatchObject({ status: 503 })
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }))
    expect(await requireSignedIn(request("c"))).toMatchObject({ status: 503 })
  })

  it("answers 503 when no absolute auth URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_BASE_URL", "/proxy/auth")
    expect(await requireSignedIn(request("tok"))).toMatchObject({ status: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("remembers a verified token for a minute", async () => {
    const t0 = 1_000_000
    await requireSignedIn(request("tok"), t0)
    await requireSignedIn(request("tok"), t0 + SIGNED_IN_CACHE_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await requireSignedIn(request("tok"), t0 + SIGNED_IN_CACHE_MS + 1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("limits one user across tokens, then lets them back in", async () => {
    const t0 = 2_000_000
    for (let i = 0; i < USER_LIMIT_MAX; i++) {
      expect(await requireSignedIn(request(`tok-${i}`), t0)).toMatchObject({
        ok: true,
      })
    }
    const blocked = await requireSignedIn(request("tok-next"), t0 + 1000)
    expect(blocked).toMatchObject({ ok: false, status: 429 })
    expect(blocked.ok === false && blocked.retryAfter).toBeGreaterThan(0)

    expect(
      await requireSignedIn(request("tok-next"), t0 + USER_LIMIT_WINDOW_MS + 1)
    ).toMatchObject({ ok: true })
  })

  it("counts each user on their own", async () => {
    const t0 = 3_000_000
    for (let i = 0; i < USER_LIMIT_MAX; i++) {
      await requireSignedIn(request("heavy"), t0)
    }
    fetchMock.mockResolvedValue(meResponse("user-2"))
    expect(await requireSignedIn(request("other"), t0)).toMatchObject({
      ok: true,
      userId: "user-2",
    })
  })
})
