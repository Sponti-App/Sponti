import { afterEach, describe, expect, it, vi } from "vitest"
import { HttpError } from "@/lib/http"

const apiFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/http")>()),
  apiFetch,
}))

const {
  adaptFlareInvitePreview,
  fetchEventInviteLink,
  fetchFlareInvitePreview,
  fetchFlareInviteStatus,
  redeemFlareInvite,
  resetEventInviteLink,
} = await import("./flare-invites")

const preview = {
  host: { displayName: "Patrick", avatarUrl: null },
  title: "drinks at klunkerkranich",
  type: "drinks",
  startAt: "2026-10-24T17:00:00.000Z",
  endAt: "2026-10-24T20:00:00.000Z",
  placeName: "klunkerkranich",
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("flare invite api (#616)", () => {
  it("reads the preview without a token, the token in the body", async () => {
    apiFetch.mockResolvedValue({ data: preview })

    expect(await fetchFlareInvitePreview("tok")).toEqual(preview)

    expect(apiFetch).toHaveBeenCalledWith(
      "/public/flare-invite-preview",
      expect.objectContaining({
        method: "POST",
        body: { token: "tok" },
        auth: false,
      })
    )
  })

  it("reads a link that doesn't work as null, whatever the reason", async () => {
    apiFetch.mockRejectedValue(
      new HttpError(404, "nope", "FLARE_INVITE_NOT_FOUND")
    )
    expect(await fetchFlareInvitePreview("tok")).toBeNull()
    apiFetch.mockRejectedValue(new HttpError(400, "bad"))
    expect(await fetchFlareInvitePreview("tok")).toBeNull()
  })

  it("lets a real failure through", async () => {
    apiFetch.mockRejectedValue(new HttpError(500, "down"))
    await expect(fetchFlareInvitePreview("tok")).rejects.toMatchObject({
      status: 500,
    })
  })

  it("drops a preview that isn't usable", () => {
    expect(adaptFlareInvitePreview(null)).toBeNull()
    expect(adaptFlareInvitePreview({ ...preview, type: "nope" })).toBeNull()
    expect(adaptFlareInvitePreview({ ...preview, startAt: "x" })).toBeNull()
    expect(adaptFlareInvitePreview({ ...preview, host: {} })).toBeNull()
    expect(adaptFlareInvitePreview({ ...preview, title: "" })).toBeNull()
  })

  it("reads where the viewer stands, and the flare only once they are on it", async () => {
    apiFetch.mockResolvedValue({
      data: { state: "invited", eventId: "e1", preview },
    })
    expect(await fetchFlareInviteStatus("tok")).toEqual({
      state: "invited",
      eventId: "e1",
      preview,
    })

    apiFetch.mockResolvedValue({
      data: { state: "waiting", eventId: null, preview },
    })
    expect(await redeemFlareInvite("tok")).toMatchObject({
      state: "waiting",
      eventId: null,
    })
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/flare-invites/redeem",
      expect.objectContaining({ method: "POST", body: { token: "tok" } })
    )
  })

  it("refuses an answer it doesn't understand", async () => {
    apiFetch.mockResolvedValue({ data: { state: "maybe", preview } })
    await expect(fetchFlareInviteStatus("tok")).rejects.toBeInstanceOf(
      HttpError
    )
  })

  it("reads and resets the host's link", async () => {
    apiFetch.mockResolvedValue({ data: { token: "t1" } })
    expect(await fetchEventInviteLink("e1")).toBe("t1")
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/events/e1/invite-link",
      expect.anything()
    )

    apiFetch.mockResolvedValue({ data: { token: "t2" } })
    expect(await resetEventInviteLink("e1")).toBe("t2")
    expect(apiFetch).toHaveBeenLastCalledWith("/events/e1/invite-link/reset", {
      method: "POST",
      body: {},
    })
  })
})
