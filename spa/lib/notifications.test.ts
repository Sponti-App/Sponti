import { describe, expect, it } from "vitest"
import type { ApiNotification } from "@/lib/api/notifications"
import { adaptApiNotification } from "./notifications"

function apiNotification(
  overrides: Partial<ApiNotification> = {}
): ApiNotification {
  return {
    _id: "n-1",
    userId: "guest-1",
    actorId: "host-1",
    type: "event_update",
    targetType: "event",
    targetId: "event-1",
    title: "Martin posted an update",
    message: "grabbing a table",
    readAt: null,
    createdAt: "2099-05-01T12:00:00.000Z",
    updatedAt: "2099-05-01T12:00:00.000Z",
    actor: { _id: "host-1", username: "martin", displayName: "Martin" },
    ...overrides,
  }
}

describe("adaptApiNotification", () => {
  it("opens the flare itself for a thread update (#140)", () => {
    const notification = adaptApiNotification(apiNotification())

    expect(notification.href).toBe("/event/event-1")
    expect(notification.intent).toBe("event")
    expect(notification.subtitle).toBe("grabbing a table")
  })

  it("keeps other event notifications on the flares list", () => {
    const notification = adaptApiNotification(
      apiNotification({ type: "event_invitation" })
    )

    expect(notification.href).toBe("/event")
  })
})
