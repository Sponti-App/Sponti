import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.sponti.test"
  return {
    fetchUnreadNotificationCount: vi.fn(),
  }
})

vi.mock("@/lib/api/notifications", () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadNotificationCount: mocks.fetchUnreadNotificationCount,
  markNotificationsReadBatch: vi.fn(),
}))

import { useNotifications, useUnreadCountRefresh } from "./use-notifications"

// #157: the unread badge was fetched once and never again, so a notification
// that arrived while the app stayed open never showed up on the Feed icon.
describe("useUnreadCountRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.fetchUnreadNotificationCount.mockResolvedValue(0)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("re-checks the count on a timer and on focus, and updates the badge", async () => {
    const { result } = renderHook(() => {
      useUnreadCountRefresh()
      return useNotifications().unreadCount
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(result.current).toBe(0)
    const afterFirstLoad = mocks.fetchUnreadNotificationCount.mock.calls.length

    // A notification arrives; the next tick picks it up.
    mocks.fetchUnreadNotificationCount.mockResolvedValue(2)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(result.current).toBe(2)

    mocks.fetchUnreadNotificationCount.mockResolvedValue(3)
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(0)
    expect(result.current).toBe(3)
    expect(
      mocks.fetchUnreadNotificationCount.mock.calls.length
    ).toBeGreaterThan(afterFirstLoad)
  })

  it("doesn't poll while the app is hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    renderHook(() => useUnreadCountRefresh())
    mocks.fetchUnreadNotificationCount.mockClear()

    await vi.advanceTimersByTimeAsync(90_000)

    expect(mocks.fetchUnreadNotificationCount).not.toHaveBeenCalled()
  })

  it("stops polling once unmounted", async () => {
    const { unmount } = renderHook(() => useUnreadCountRefresh())
    unmount()
    mocks.fetchUnreadNotificationCount.mockClear()

    await vi.advanceTimersByTimeAsync(90_000)

    expect(mocks.fetchUnreadNotificationCount).not.toHaveBeenCalled()
  })
})
