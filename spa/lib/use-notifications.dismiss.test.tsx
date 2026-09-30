import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.sponti.test"
  return {
    fetchNotifications: vi.fn(),
    fetchUnreadNotificationCount: vi.fn(),
    dismissNotification: vi.fn(),
  }
})

vi.mock("@/lib/api/notifications", () => ({
  fetchNotifications: mocks.fetchNotifications,
  fetchUnreadNotificationCount: mocks.fetchUnreadNotificationCount,
  markNotificationsReadBatch: vi
    .fn()
    .mockResolvedValue({ markedRead: 0, unreadCount: 0 }),
  markAllNotificationsRead: vi.fn(),
  dismissNotification: mocks.dismissNotification,
}))
vi.mock("@/lib/use-events", () => ({ emitEventsChanged: vi.fn() }))

import { dismiss, loadLatest, useNotifications } from "./use-notifications"

function notification(id: string, read = false) {
  return {
    id,
    type: "event_invitation",
    targetType: "event",
    targetId: `event-${id}`,
    title: id,
    subtitle: "",
    createdAt: "2026-09-30T10:00:00.000Z",
    readAt: read ? "2026-09-30T10:00:00.000Z" : null,
    read,
    href: "/event",
    intent: "event",
    actorName: null,
  }
}

// #173: swiping a row away hides it and keeps it hidden.
describe("dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchUnreadNotificationCount.mockResolvedValue(2)
    mocks.fetchNotifications.mockResolvedValue({
      notifications: [notification("a"), notification("b")],
      pagination: { nextCursor: null },
    })
  })

  it("hides the row at once, persists it, and takes the server's unread count", async () => {
    const { result } = renderHook(() => useNotifications())
    await act(async () => {
      await loadLatest()
    })
    mocks.dismissNotification.mockResolvedValue({ unreadCount: 1 })

    await act(async () => {
      await dismiss("a")
    })

    expect(mocks.dismissNotification).toHaveBeenCalledWith("a")
    expect(result.current.notifications.map((n) => n.id)).toEqual(["b"])
    expect(result.current.unreadCount).toBe(1)
  })

  it("keeps it hidden on the next fetch even if the server call failed", async () => {
    const { result } = renderHook(() => useNotifications())
    await act(async () => {
      await loadLatest()
    })
    mocks.dismissNotification.mockRejectedValue(new Error("offline"))
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await act(async () => {
      await dismiss("b")
    })
    await act(async () => {
      await loadLatest()
    })

    expect(result.current.notifications.map((n) => n.id)).not.toContain("b")
  })
})
