import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useGeolocation } from "./geolocation"

// #409: location messages are all lowercase product copy (BRAND.md, #339).
// #412: the browser's own error text is never shown, only logged.

function stubGeolocation(code: number, message = "") {
  const error = {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  }
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) =>
        fail(error),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, "geolocation")
})

describe("useGeolocation error messages", () => {
  it("says location permission denied in lowercase", () => {
    stubGeolocation(1)
    const { result } = renderHook(() => useGeolocation({ autoRequest: false }))
    act(() => result.current.request())
    expect(result.current.status).toBe("denied")
    expect(result.current.errorMessage).toBe("location permission denied")
  })

  it("says location unavailable in lowercase", () => {
    stubGeolocation(2)
    const { result } = renderHook(() => useGeolocation({ autoRequest: false }))
    act(() => result.current.request())
    expect(result.current.status).toBe("unavailable")
    expect(result.current.errorMessage).toBe("location unavailable")
  })

  it("says location timed out for a timeout", () => {
    stubGeolocation(3)
    const { result } = renderHook(() => useGeolocation({ autoRequest: false }))
    act(() => result.current.request())
    expect(result.current.status).toBe("error")
    expect(result.current.errorMessage).toBe("location timed out")
  })

  it.each([
    [1, "location permission denied"],
    [2, "location unavailable"],
    [3, "location timed out"],
    [0, "unable to determine location"],
  ])(
    "shows our copy for code %i, not the browser's message",
    (code, expected) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      stubGeolocation(code, "User denied Geolocation")
      const { result } = renderHook(() =>
        useGeolocation({ autoRequest: false })
      )
      act(() => result.current.request())
      expect(result.current.errorMessage).toBe(expected)
      expect(warn).toHaveBeenCalledWith(
        "[Sponti] geolocation error:",
        "User denied Geolocation"
      )
    }
  )

  it("says geolocation is not supported when the browser has none", () => {
    const { result } = renderHook(() => useGeolocation({ autoRequest: false }))
    act(() => result.current.request())
    expect(result.current.status).toBe("unavailable")
    expect(result.current.errorMessage).toBe("geolocation not supported")
  })

  it("says location needs a secure connection on an insecure origin", () => {
    stubGeolocation(1)
    vi.stubGlobal("isSecureContext", false)
    vi.spyOn(window, "location", "get").mockReturnValue({
      hostname: "192.168.1.20",
    } as Location)
    const { result } = renderHook(() => useGeolocation({ autoRequest: false }))
    act(() => result.current.request())
    expect(result.current.status).toBe("unavailable")
    expect(result.current.errorMessage).toBe(
      "location needs a secure connection, open this app on localhost or https"
    )
    vi.unstubAllGlobals()
  })
})
