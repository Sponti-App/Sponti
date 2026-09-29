import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.sponti.test"
  return {
    fetchNotifications: vi.fn(),
    fetchUnreadNotificationCount: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    emitEventsChanged: vi.fn(),
  }
})

vi.mock("@/lib/api/notifications", () => ({
  fetchNotifications: mocks.fetchNotifications,
  fetchUnreadNotificationCount: mocks.fetchUnreadNotificationCount,
  // Resolved (not left as a bare vi.fn()) so the 900ms auto-read timer
  // loadLatest() schedules doesn't reject unobserved once markAllRead tests
  // start actually loading notifications into the store.
  markNotificationsReadBatch: vi
    .fn()
    .mockResolvedValue({ markedRead: 0, unreadCount: 0 }),
  markAllNotificationsRead: mocks.markAllNotificationsRead,
}))

vi.mock("@/lib/use-events", () => ({
  emitEventsChanged: mocks.emitEventsChanged,
}))

import {
  markAllRead,
  refreshUnreadCount,
  useNotifications,
  useUnreadCountRefresh,
} from "./use-notifications"

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

  // #197: the host was seeing "0 going" with the rsvp notification already
  // in their feed. Nudging the events store when the unread count rises
  // means an already-mounted event list refetches instead of waiting for a
  // remount.
  it("emits an events-changed signal when the unread count rises", async () => {
    // The store is a module singleton shared across cases in this file, so
    // seed a known baseline before asserting on a transition from it.
    mocks.fetchUnreadNotificationCount.mockResolvedValue(0)
    await refreshUnreadCount()
    mocks.emitEventsChanged.mockClear()

    renderHook(() => {
      useUnreadCountRefresh()
      return useNotifications().unreadCount
    })

    mocks.fetchUnreadNotificationCount.mockResolvedValue(1)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mocks.emitEventsChanged).toHaveBeenCalledTimes(1)
  })

  it("does not emit when the count stays the same or drops", async () => {
    mocks.fetchUnreadNotificationCount.mockResolvedValue(2)
    await refreshUnreadCount()
    mocks.emitEventsChanged.mockClear()

    renderHook(() => useUnreadCountRefresh())

    // Same count on the next poll.
    await vi.advanceTimersByTimeAsync(30_000)
    // A drop, e.g. after marking notifications read elsewhere.
    mocks.fetchUnreadNotificationCount.mockResolvedValue(0)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mocks.emitEventsChanged).not.toHaveBeenCalled()
  })
})

// #176: "I'm caught up" must clear both the loaded list's unread dots and
// the badge count, and record when it happened so the feed can collapse.
describe("markAllRead", () => {
  const notification = {
    id: "n1",
    type: "event_invitation" as const,
    targetType: "event" as const,
    targetId: "e1",
    title: "you're invited",
    subtitle: "tap to view",
    createdAt: new Date().toISOString(),
    readAt: null,
    read: false,
    href: "/event",
    intent: "event" as const,
    actorName: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks the loaded notifications read, zeroes the unread count, and records when caught up", async () => {
    mocks.fetchNotifications.mockResolvedValue({
      notifications: [notification],
      pagination: { nextCursor: null },
    })
    mocks.markAllNotificationsRead.mockResolvedValue({
      markedRead: 1,
      unreadCount: 0,
    })

    const { result } = renderHook(() => useNotifications())
    await act(async () => {
      await result.current.loadLatest()
    })
    expect(result.current.notifications[0]?.read).toBe(false)
    expect(result.current.caughtUpAt).toBeNull()

    await act(async () => {
      await markAllRead()
    })

    expect(mocks.markAllNotificationsRead).toHaveBeenCalledTimes(1)
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications[0]?.read).toBe(true)
    expect(result.current.caughtUpAt).not.toBeNull()
  })

  it("leaves the list untouched and shows an error if the request fails", async () => {
    mocks.fetchNotifications.mockResolvedValue({
      notifications: [notification],
      pagination: { nextCursor: null },
    })
    mocks.markAllNotificationsRead.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useNotifications())
    await act(async () => {
      await result.current.loadLatest()
    })
    // The store is a module singleton shared across cases in this file, so
    // compare against the caught-up state going in rather than assuming null.
    const caughtUpAtBefore = result.current.caughtUpAt

    await act(async () => {
      await markAllRead()
    })

    expect(result.current.notifications[0]?.read).toBe(false)
    expect(result.current.caughtUpAt).toBe(caughtUpAtBefore)
    expect(result.current.error).toBe("couldn't mark as read, try again")
  })
})
