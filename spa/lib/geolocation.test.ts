import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useGeolocation } from "./geolocation"

// #409: location messages are all lowercase product copy (BRAND.md, #339).

function stubGeolocation(code: number) {
  const error = {
    code,
    message: "",
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

  it("falls back to a lowercase message when the error has none", () => {
    stubGeolocation(3)
    const { result } = renderHook(() => useGeolocation({ autoRequest: false }))
    act(() => result.current.request())
    expect(result.current.status).toBe("error")
    expect(result.current.errorMessage).toBe("unable to determine location")
  })
})
