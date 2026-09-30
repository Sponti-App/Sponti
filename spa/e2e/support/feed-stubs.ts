import type { Page, Request } from "@playwright/test"
import { API_BASE, STUB_USER, stubBackend } from "./stubs"

// Stubs for the feed's row actions (#173, #174, #226): one pending
// connection request from maya and one flare invite, plus the connection,
// circle and dismiss endpoints those rows call. Layered on top of
// stubBackend — routes registered later win in Playwright.

export const REQUEST_CONNECTION_ID = "conn-e2e-1"
export const MAYA_ID = "user-e2e-maya"

function feed() {
  const now = Date.now()
  const at = (minutesAgo: number) =>
    new Date(now - minutesAgo * 60_000).toISOString()
  const maya = { _id: MAYA_ID, username: "maya", displayName: "maya" }
  return [
    {
      _id: "notification-request",
      userId: STUB_USER.id,
      actorId: MAYA_ID,
      type: "connection_request",
      targetType: "connection",
      targetId: REQUEST_CONNECTION_ID,
      title: "maya wants to connect",
      message: "Tap to respond to the request.",
      readAt: null,
      createdAt: at(2),
      updatedAt: at(2),
      actor: maya,
    },
    {
      _id: "notification-invite",
      userId: STUB_USER.id,
      actorId: MAYA_ID,
      type: "event_invitation",
      targetType: "event",
      targetId: "event-e2e-1",
      title: "maya invited you",
      message: "to friday drinks",
      readAt: null,
      createdAt: at(5),
      updatedAt: at(5),
      actor: maya,
    },
  ]
}

const circles = [
  {
    _id: "circle-all",
    ownerId: STUB_USER.id,
    name: "all friends",
    type: "all",
    members: [],
  },
  {
    _id: "circle-close",
    ownerId: STUB_USER.id,
    name: "close friends",
    type: "close",
    members: [],
  },
  {
    _id: "circle-inner",
    ownerId: STUB_USER.id,
    name: "inner circle",
    type: "inner",
    members: [],
  },
]

export type FeedCalls = {
  /** Every mutating request the rows sent, as "METHOD /path body". */
  writes: string[]
}

function describe(request: Request, path: string): string {
  const body = request.postData()
  return `${request.method()} ${path}${body ? ` ${body}` : ""}`
}

export async function stubFeedWithRequest(page: Page): Promise<FeedCalls> {
  await stubBackend(page)
  const calls: FeedCalls = { writes: [] }
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  })

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api\/v1/, "")
    const method = request.method()

    if (method === "GET" && path === "/notifications") {
      await route.fulfill(
        json({ data: feed(), pagination: { nextCursor: null } })
      )
      return
    }
    if (method === "GET" && path === "/notifications/unread-count") {
      await route.fulfill(json({ data: { count: 2 } }))
      return
    }
    if (method === "GET" && path === "/connections") {
      const pending =
        url.searchParams.get("status") === "pending" &&
        url.searchParams.get("direction") === "incoming"
      await route.fulfill(
        json({
          data: pending
            ? [
                {
                  _id: REQUEST_CONNECTION_ID,
                  requesterId: MAYA_ID,
                  receiverId: STUB_USER.id,
                  status: "pending",
                  otherUser: {
                    _id: MAYA_ID,
                    username: "maya",
                    displayName: "maya",
                  },
                },
              ]
            : [],
          pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
        })
      )
      return
    }
    if (method === "GET" && path === "/circles") {
      await route.fulfill(json({ data: circles }))
      return
    }
    if (method === "PATCH" && path === "/notifications/read-batch") {
      await route.fulfill(json({ data: { markedRead: 0, unreadCount: 2 } }))
      return
    }
    if (method !== "GET") {
      calls.writes.push(describe(request, path))
      await route.fulfill(json({ data: { unreadCount: 1 } }))
      return
    }
    await route.fallback()
  })

  return calls
}
