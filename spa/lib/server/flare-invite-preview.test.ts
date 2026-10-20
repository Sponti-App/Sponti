import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchFlareInvitePreviewOnServer,
  flareInviteCard,
  isFlareInviteToken,
} from "./flare-invite-preview"

const TOKEN = "tok_ABC-123"

// 17:00 UTC on Saturday 24 October 2026 is 19:00 in Berlin.
const preview = {
  host: { displayName: "Patrick Caire", avatarUrl: null },
  title: "Drinks at Klunkerkranich",
  type: "drinks",
  startAt: "2026-10-24T17:00:00.000Z",
  endAt: "2026-10-24T20:00:00.000Z",
  placeName: "klunkerkranich",
}

const respond = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )

describe("fetchFlareInvitePreviewOnServer (#616)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.sponti.test/api/v1/")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("asks the public preview endpoint with the token in the body, uncached", async () => {
    const fetchMock = respond({ data: preview })

    expect(
      await fetchFlareInvitePreviewOnServer(TOKEN, fetchMock as typeof fetch)
    ).toMatchObject({ title: "Drinks at Klunkerkranich" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      "https://api.sponti.test/api/v1/public/flare-invite-preview"
    )
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ token: TOKEN }),
      cache: "no-store",
    })
    // No credentials: it is the same call a signed-out visitor makes.
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i)
  })

  it.each([
    ["a link that no longer works", respond({ error: {} }, 404)],
    ["the api rate limiting us", respond({ error: {} }, 429)],
    ["a server error", respond({ error: {} }, 500)],
    ["an answer it can't read", respond({ data: { title: "x" } })],
    ["no answer at all", vi.fn().mockRejectedValue(new Error("offline"))],
  ])("reads %s as no preview", async (_label, fetchMock) => {
    expect(
      await fetchFlareInvitePreviewOnServer(TOKEN, fetchMock as typeof fetch)
    ).toBeNull()
  })

  it("never calls the api for something that isn't a token", async () => {
    const fetchMock = respond({ data: preview })

    expect(
      await fetchFlareInvitePreviewOnServer(
        "not a token!",
        fetchMock as typeof fetch
      )
    ).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(isFlareInviteToken("a".repeat(129))).toBe(false)
    expect(isFlareInviteToken(TOKEN)).toBe(true)
  })

  it("has no preview where the api isn't an absolute URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api-proxy")
    const fetchMock = respond({ data: preview })

    expect(
      await fetchFlareInvitePreviewOnServer(TOKEN, fetchMock as typeof fetch)
    ).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("flareInviteCard (#616)", () => {
  const card = flareInviteCard(
    {
      ...preview,
      type: "drinks",
    } as Parameters<typeof flareInviteCard>[0],
    new Date("2026-10-22T10:00:00Z").getTime()
  )

  it("says who invited them to what, as a sentence, with names as typed", () => {
    expect(card.title).toBe("Patrick invited you to Drinks at Klunkerkranich")
    expect(card.invitedLine).toBe("Patrick invited you")
    expect(card.flareTitle).toBe("Drinks at Klunkerkranich")
  })

  it("gives the day, date and time in berlin, whatever the server's clock", () => {
    expect(card.meta).toMatch(
      /^Saturday, October 24 at 7:00\s?PM · klunkerkranich$/
    )
    expect(card.description).toMatch(
      /^Drinks · Saturday, October 24 at 7:00\s?PM · klunkerkranich$/
    )
  })

  it("says now while the flare is on", () => {
    const live = flareInviteCard(
      preview as Parameters<typeof flareInviteCard>[0],
      new Date("2026-10-24T18:00:00Z").getTime()
    )
    expect(live.meta).toBe("Happening now · klunkerkranich")
  })

  it("carries nothing beyond what the public preview has", () => {
    expect(Object.keys(card).sort()).toEqual([
      "description",
      "flareTitle",
      "hostName",
      "invitedLine",
      "meta",
      "title",
    ])
  })
})
