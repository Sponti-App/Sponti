import { expect, type Page } from "@playwright/test"
import { API_BASE, STUB_USER } from "./stubs"

// #380: the unread poll and the feed, driven by the spec. `arrive()` adds
// notifications (newest first, as the api returns them) and raises the
// unread count; `poll()` runs the app's refresh the way regaining focus does.

type Join = {
  id: string
  actor: string
  firstJoin?: boolean
  change?: "joined" | "declined"
  eventTitle?: string
}

export async function stubJoinNotifications(page: Page) {
  const notifications: unknown[] = []
  const unread = () =>
    notifications.filter((n) => !(n as { readAt: string | null }).readAt).length

  let counted = 0
  await page.route(`${API_BASE}/**/notifications/unread-count`, (route) => {
    counted += 1
    return route.fulfill({ json: { data: { count: unread() } } })
  })
  await page.route(
    (url) =>
      url.href.startsWith(API_BASE) &&
      /^(\/api\/v1)?\/notifications$/.test(url.pathname),
    (route) =>
      route.fulfill({
        json: { data: notifications, pagination: { nextCursor: null } },
      })
  )

  return {
    arrive(joins: Join[]) {
      for (const j of joins) {
        const change = j.change ?? "joined"
        const now = new Date().toISOString()
        notifications.unshift({
          _id: j.id,
          userId: STUB_USER.id,
          actorId: `user-${j.actor}`,
          type: "event_rsvp_change",
          targetType: "event",
          targetId: "0123456789abcdef01234567",
          title: "",
          message: "",
          readAt: null,
          metadata: {
            eventTitle: j.eventTitle ?? "drinks at the canal",
            rsvpStatus: change === "joined" ? "going" : "declined",
            rsvpChange: change,
            firstJoin: j.firstJoin ?? false,
          },
          createdAt: now,
          updatedAt: now,
          actor: { _id: `user-${j.actor}`, username: j.actor },
        })
      }
    },
    /** The app has loaded its first count: only a rise after it plays. */
    loaded: () => expect.poll(() => counted).toBeGreaterThan(0),
    poll: () => page.evaluate(() => window.dispatchEvent(new Event("focus"))),
  }
}
