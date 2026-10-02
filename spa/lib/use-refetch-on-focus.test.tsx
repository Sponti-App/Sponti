import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useRefetchOnFocus } from "./use-refetch-on-focus"

// #158: screens that fetch once on mount never catch up with changes made
// by another account. This is the shared mechanism every such screen wires
// in, mirroring the focus/visibilitychange pattern `useUnreadCountRefresh`
// already used for the notification badge (#197).
describe("useRefetchOnFocus", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("runs the callback on window focus", () => {
    const onRefetch = vi.fn()
    renderHook(() => useRefetchOnFocus(onRefetch))

    window.dispatchEvent(new Event("focus"))

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it("runs the callback on visibilitychange while visible", () => {
    const onRefetch = vi.fn()
    renderHook(() => useRefetchOnFocus(onRefetch))

    document.dispatchEvent(new Event("visibilitychange"))

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it("does not run while the app is hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    const onRefetch = vi.fn()
    renderHook(() => useRefetchOnFocus(onRefetch))

    window.dispatchEvent(new Event("focus"))

    expect(onRefetch).not.toHaveBeenCalled()
  })

  it("throttles back-to-back focus events", () => {
    const onRefetch = vi.fn()
    renderHook(() => useRefetchOnFocus(onRefetch, { minIntervalMs: 15_000 }))

    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("focus"))
    expect(onRefetch).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(15_000)
    window.dispatchEvent(new Event("focus"))
    expect(onRefetch).toHaveBeenCalledTimes(2)
  })

  it("does nothing when disabled", () => {
    const onRefetch = vi.fn()
    renderHook(() => useRefetchOnFocus(onRefetch, { enabled: false }))

    window.dispatchEvent(new Event("focus"))

    expect(onRefetch).not.toHaveBeenCalled()
  })

  it("stops listening once unmounted", () => {
    const onRefetch = vi.fn()
    const { unmount } = renderHook(() => useRefetchOnFocus(onRefetch))
    unmount()

    window.dispatchEvent(new Event("focus"))

    expect(onRefetch).not.toHaveBeenCalled()
  })

  it("always calls the latest callback even if identity changes", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useRefetchOnFocus(cb), {
      initialProps: { cb: first },
    })

    rerender({ cb: second })
    window.dispatchEvent(new Event("focus"))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
