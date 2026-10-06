import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  adaptPublicMapPin,
  fetchPublicMapPins,
  type ApiPublicMapPin,
} from "./public-map"

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock("@/lib/http", () => ({ apiFetch: mocks.apiFetch }))

const PIN: ApiPublicMapPin = {
  _id: "event-1",
  type: "drinks",
  location: { type: "Point", coordinates: [13.42, 52.5] },
  startAt: "2026-06-15T11:50:00.000Z",
  endAt: "2026-06-15T13:30:00.000Z",
}

beforeEach(() => {
  mocks.apiFetch.mockReset()
})

describe("fetchPublicMapPins (#389)", () => {
  it("asks the public endpoint for the area, without a token", async () => {
    mocks.apiFetch.mockResolvedValue({ data: [] })
    const controller = new AbortController()

    await fetchPublicMapPins({ lat: 52.5, lng: 13.42 }, 10, controller.signal)

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1)
    const [path, options] = mocks.apiFetch.mock.calls[0]
    const url = new URL(path, "http://sponti.invalid")
    expect(url.pathname).toBe("/public/events/map")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lng: "13.42",
      lat: "52.5",
      radiusKm: "10",
    })
    expect(options).toEqual({ auth: false, signal: controller.signal })
  })

  it("uses the api's default radius when none is given", async () => {
    mocks.apiFetch.mockResolvedValue({ data: [] })
    await fetchPublicMapPins({ lat: 52.5, lng: 13.42 })
    const url = new URL(
      mocks.apiFetch.mock.calls[0][0],
      "http://sponti.invalid"
    )
    expect(url.searchParams.get("radiusKm")).toBe("25")
  })

  it("turns each pin into an open-to-all map pin with a lat/lng position", async () => {
    mocks.apiFetch.mockResolvedValue({ data: [PIN] })

    await expect(
      fetchPublicMapPins({ lat: 52.5, lng: 13.42 })
    ).resolves.toEqual([
      {
        id: "event-1",
        type: "drinks",
        visibility: "public",
        startAt: PIN.startAt,
        endAt: PIN.endAt,
        position: { lat: 52.5, lng: 13.42 },
      },
    ])
  })

  it("drops pins it can't place and keeps the rest", async () => {
    mocks.apiFetch.mockResolvedValue({
      data: [
        PIN,
        { ...PIN, _id: "" },
        { ...PIN, _id: "bad-type", type: "rave" },
        { ...PIN, _id: "bad-coords", location: { coordinates: [200, 52] } },
        { ...PIN, _id: "no-location", location: undefined },
        { ...PIN, _id: "bad-time", startAt: "soon" },
        null,
      ],
    })

    const pins = await fetchPublicMapPins({ lat: 52.5, lng: 13.42 })
    expect(pins.map((p) => p.id)).toEqual(["event-1"])
  })

  it("treats a body without a list as no pins", async () => {
    mocks.apiFetch.mockResolvedValue({})
    await expect(
      fetchPublicMapPins({ lat: 52.5, lng: 13.42 })
    ).resolves.toEqual([])
  })

  it("lets a failed request reach the caller", async () => {
    mocks.apiFetch.mockRejectedValue(new Error("offline"))
    await expect(fetchPublicMapPins({ lat: 52.5, lng: 13.42 })).rejects.toThrow(
      "offline"
    )
  })
})

describe("adaptPublicMapPin", () => {
  it("never carries more than a pin needs, whatever the api adds", () => {
    const pin = adaptPublicMapPin({
      ...PIN,
      title: "secret plans",
      hostId: "user-1",
      locationName: "my flat",
    })
    expect(pin && Object.keys(pin).sort()).toEqual([
      "endAt",
      "id",
      "position",
      "startAt",
      "type",
      "visibility",
    ])
  })
})
