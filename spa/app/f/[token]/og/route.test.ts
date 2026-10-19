// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

// #616: the image in a flare invite link's preview. A live link gets a PNG
// that expires quickly; any other token goes to the site's generic image.

const preview = {
  host: { displayName: "Patrick Caire", avatarUrl: null },
  title: "drinks at klunkerkranich",
  type: "drinks",
  startAt: "2099-10-24T17:00:00.000Z",
  endAt: "2099-10-24T20:00:00.000Z",
  placeName: "klunkerkranich",
}

const get = (token: string) =>
  GET(new Request(`https://app.sponti.test/f/${token}/og`), {
    params: Promise.resolve({ token }),
  })

describe("flare invite link image (#616)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.sponti.test")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("draws a live link as a PNG that is only cached for a minute", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: preview })))
    )

    const response = await get("tok_123")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=60"
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    // PNG signature.
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it.each([
    [
      "a link that no longer works",
      vi.fn().mockResolvedValue(new Response("{}", { status: 404 })),
    ],
    ["an api that is down", vi.fn().mockRejectedValue(new Error("offline"))],
  ])("sends %s to the generic image", async (_label, fetchMock) => {
    vi.stubGlobal("fetch", fetchMock)

    const response = await get("tok_123")

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://app.sponti.test/opengraph-image.png"
    )
  })

  it("sends something that isn't a token to the generic image without asking the api", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const response = await get("a/b")

    expect(response.status).toBe(307)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
