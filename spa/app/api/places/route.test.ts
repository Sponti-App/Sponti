// @vitest-environment node
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetSignedInState } from "@/lib/server/require-signed-in"
import { GET as geocode } from "../geocode/route"
import { GET as placeDetails } from "./[placeId]/route"
import { GET as places } from "./route"

// #541: none of the three Google proxies may reach Google for a caller who
// is not signed in.
let fetchMock: ReturnType<typeof vi.fn>

const call = (url: string, token?: string) =>
  new NextRequest(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

beforeEach(() => {
  resetSignedInState()
  vi.stubEnv("NEXT_PUBLIC_AUTH_BASE_URL", "https://auth.test")
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-key")
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).startsWith("https://auth.test/")) {
      return new Response(JSON.stringify({ user: { id: "u1" } }))
    }
    return new Response(JSON.stringify({ suggestions: [], results: [] }))
  })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const googleCalls = () =>
  fetchMock.mock.calls.filter(
    ([url]) => !String(url).startsWith("https://auth.test/")
  )

describe("Google proxy routes", () => {
  it("places autocomplete: 401 and no Google call without a token", async () => {
    const res = await places(call("https://app.test/api/places?input=cafe"))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ suggestions: [] })
    expect(googleCalls()).toHaveLength(0)
  })

  it("place details: 401 and no Google call without a token", async () => {
    const res = await placeDetails(
      call("https://app.test/api/places/ChIJabc"),
      { params: Promise.resolve({ placeId: "ChIJabc" }) }
    )
    expect(res.status).toBe(401)
    expect(googleCalls()).toHaveLength(0)
  })

  it("geocode: 401 and no Google call without a token", async () => {
    const res = await geocode(
      call("https://app.test/api/geocode?lat=52.5&lng=13.4")
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ area: null, locality: null })
    expect(googleCalls()).toHaveLength(0)
  })

  it("a token the auth-server rejects gets 401 and no Google call", async () => {
    fetchMock.mockImplementation(
      async () => new Response("{}", { status: 401 })
    )
    const res = await places(
      call("https://app.test/api/places?input=cafe", "forged")
    )
    expect(res.status).toBe(401)
    expect(googleCalls()).toHaveLength(0)
  })

  it("a signed-in user reaches Google", async () => {
    const res = await places(
      call("https://app.test/api/places?input=cafe", "good")
    )
    expect(res.status).toBe(200)
    expect(googleCalls()).toHaveLength(1)
  })
})
