import { beforeEach, describe, expect, it, vi } from "vitest"

const apiFetch = vi.fn()

vi.mock("./http", async () => {
  const actual = await vi.importActual<typeof import("./http")>("./http")
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) }
})

import { HttpError } from "./http"
import { computeRoute } from "./routes-api"

const origin = { lat: 38.5, lng: -120.2 }
const destination = { lat: 40.7, lng: -120.95 }

describe("computeRoute", () => {
  beforeEach(() => apiFetch.mockReset())

  it("decodes the polyline and formats labels", async () => {
    // Google's documented example polyline.
    apiFetch.mockResolvedValue({
      data: {
        encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        durationSeconds: 600,
        distanceMeters: 1609.344,
      },
    })
    const result = await computeRoute(origin, destination)
    expect(result.path).toHaveLength(3)
    expect(result.path[0]).toEqual({ lat: 38.5, lng: -120.2 })
    expect(result.etaLabel).toBe("10 min")
  })

  // Callers (flare page, map detail sheet) already catch and show their
  // no-route state; a TypeError from decodePolyline(undefined) skipped that.
  it.each([undefined, ""])(
    "rejects with a typed no-route error when the polyline is %j",
    async (encodedPolyline) => {
      apiFetch.mockResolvedValue({
        data: { encodedPolyline, durationSeconds: 600, distanceMeters: 500 },
      })
      const err = await computeRoute(origin, destination).catch((e) => e)
      expect(err).toBeInstanceOf(HttpError)
      expect(err).not.toBeInstanceOf(TypeError)
      expect(err).toMatchObject({ status: 404, code: "ROUTE_NOT_FOUND" })
    }
  )
})
