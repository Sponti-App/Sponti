import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateMetadata } from "./layout"

// #616: the link preview of a flare's invite link. A live link gets its own
// card; every other link keeps the site's generic one.

const preview = {
  host: { displayName: "Patrick Caire", avatarUrl: null },
  title: "drinks at klunkerkranich",
  type: "drinks",
  startAt: "2099-10-24T17:00:00.000Z",
  endAt: "2099-10-24T20:00:00.000Z",
  placeName: "klunkerkranich",
}

const answer = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))

const forToken = (token: string) =>
  generateMetadata({ params: Promise.resolve({ token }) })

describe("flare invite link metadata (#616)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.sponti.test")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("gives a live link its own title, description and image, kept out of search", async () => {
    vi.stubGlobal("fetch", answer({ data: preview }))

    const metadata = await forToken("tok_123")

    expect(metadata.title).toBe(
      "patrick invited you to drinks at klunkerkranich"
    )
    expect(metadata.description).toMatch(
      /^drinks · sat 7:00\s?pm · klunkerkranich$/
    )
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.openGraph).toMatchObject({
      title: "patrick invited you to drinks at klunkerkranich",
      images: [{ url: "/f/tok_123/og", width: 1200, height: 630 }],
    })
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/f/tok_123/og"],
    })
  })

  it.each([
    ["unknown, reset, ended or cancelled", answer({ error: {} }, 404)],
    ["rate limited", answer({ error: {} }, 429)],
    ["offline", vi.fn().mockRejectedValue(new Error("offline"))],
  ])(
    "leaves a %s link on the site's generic preview",
    async (_label, fetchMock) => {
      vi.stubGlobal("fetch", fetchMock)

      const metadata = await forToken("tok_123")

      // Nothing of its own: the root layout's title, description and image stay.
      expect(metadata).toEqual({ robots: { index: false, follow: false } })
    }
  )

  it("doesn't even ask the api about something that isn't a token", async () => {
    const fetchMock = answer({ data: preview })
    vi.stubGlobal("fetch", fetchMock)

    expect(await forToken("%3Cscript%3E")).toEqual({
      robots: { index: false, follow: false },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
