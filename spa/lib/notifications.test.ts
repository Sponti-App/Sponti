import { describe, expect, it } from "vitest"
import type { ApiNotification } from "@/lib/api/notifications"
import { adaptApiNotification, isJoinNotification } from "./notifications"

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

    expect(notification.href).toBe("/event/event-1?tab=updates")
    expect(notification.intent).toBe("event")
    expect(notification.subtitle).toBe("grabbing a table")
  })

  it.each([
    "event_rsvp_change",
    "event_invitation",
    "event_cancelled",
    "event_reactivated",
  ] as const)("opens the flare itself for %s (#430)", (type) => {
    const notification = adaptApiNotification(apiNotification({ type }))

    expect(notification.href).toBe("/event/event-1")
  })

  it("keeps a removed guest's notice on the flares list (#430)", () => {
    const notification = adaptApiNotification(
      apiNotification({ type: "event_guest_removed" })
    )

    expect(notification.href).toBe("/event")
  })

  it("opens the people tab for connection notices", () => {
    for (const type of ["connection_request", "connection_accepted"] as const) {
      const notification = adaptApiNotification(
        apiNotification({ type, targetType: "connection" })
      )

      expect(notification.href).toBe("/circles?tab=people")
    }
  })
})

// #414: the host's "mia joined your flare" needs the join itself, not the copy.
describe("adaptApiNotification for rsvp changes", () => {
  const rsvpNotification = (metadata?: Record<string, unknown>) =>
    apiNotification({
      type: "event_rsvp_change",
      actorId: "guest-1",
      actor: {
        _id: "guest-1",
        username: "mia",
        displayName: "mia",
        avatarUrl: "https://example.com/mia.jpg",
      },
      title: "mia updated their RSVP",
      message: "mia is going to sunset swim.",
      metadata,
    })

  it("reads a join, with the joiner's photo, the flare title and the ETA", () => {
    const notification = adaptApiNotification(
      rsvpNotification({
        eventTitle: "sunset swim",
        rsvpStatus: "going",
        memberWillArriveAt: "2099-05-01T12:20:00.000Z",
        arrivalStatus: null,
        rsvpChange: "joined",
        firstJoin: true,
      })
    )

    expect(notification.actorName).toBe("mia")
    expect(notification.actorAvatarUrl).toBe("https://example.com/mia.jpg")
    expect(notification.rsvp).toEqual({
      change: "joined",
      status: "going",
      firstJoin: true,
      eventTitle: "sunset swim",
      willArriveAt: "2099-05-01T12:20:00.000Z",
      arrivalStatus: null,
    })
    expect(isJoinNotification(notification)).toBe(true)
  })

  it("never calls an arrival update or a decline a join", () => {
    const update = adaptApiNotification(
      rsvpNotification({
        rsvpStatus: "going",
        arrivalStatus: "running_late",
        rsvpChange: "arrival_updated",
        firstJoin: false,
      })
    )
    const decline = adaptApiNotification(
      rsvpNotification({ rsvpStatus: "declined", rsvpChange: "declined" })
    )

    expect(update.rsvp?.arrivalStatus).toBe("running_late")
    expect(isJoinNotification(update)).toBe(false)
    expect(isJoinNotification(decline)).toBe(false)
  })

  it("still parses a notification written before #414, as an unknown change", () => {
    const notification = adaptApiNotification(
      rsvpNotification({
        eventTitle: "sunset swim",
        rsvpStatus: "going",
        memberWillArriveAt: null,
      })
    )

    expect(notification.rsvp).toEqual({
      change: null,
      status: "going",
      firstJoin: false,
      eventTitle: "sunset swim",
      willArriveAt: null,
      arrivalStatus: null,
    })
    expect(isJoinNotification(notification)).toBe(false)
  })

  it("ignores missing or unexpected metadata", () => {
    const bare = adaptApiNotification(rsvpNotification(undefined))
    const odd = adaptApiNotification(
      rsvpNotification({
        rsvpChange: "teleported",
        firstJoin: "yes",
        rsvpStatus: 3,
        memberWillArriveAt: "",
      })
    )

    expect(bare.rsvp?.change).toBeNull()
    expect(odd.rsvp).toMatchObject({
      change: null,
      status: null,
      firstJoin: false,
      willArriveAt: null,
    })
  })

  it("only sets rsvp details on rsvp changes", () => {
    const notification = adaptApiNotification(apiNotification())

    expect(notification.rsvp).toBeUndefined()
    expect(notification.actorAvatarUrl).toBeNull()
  })
})
