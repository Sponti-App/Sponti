import type { Page, Route } from "@playwright/test"
import { API_BASE, AUTH_BASE, STUB_USER } from "./stubs"

// #124: a signed-OUT visitor opening someone's QR/invite link. Unlike
// stubBackend() this seeds no session — the visitor registers during the
// test, and every auth/api call is answered here (never a real server).

export const INVITER = {
  id: "user-e2e-inviter",
  username: "alex",
  displayName: "Alex Kim",
}

type ContactStubOptions = {
  /** Display name the public preview returns; null → 404 (link not live). */
  previewName?: string | null
  /** #441: the QR code has run out, but is still inside the request window. */
  qrExpired?: boolean
}

export type ContactStubCalls = {
  previews: unknown[]
  resolves: Array<{ path: string; body: unknown; auth: string | null }>
  registrations: unknown[]
  logins: unknown[]
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

export async function stubSignedOutContactFlow(
  page: Page,
  options: ContactStubOptions = {}
): Promise<ContactStubCalls> {
  const previewName =
    options.previewName === undefined
      ? INVITER.displayName
      : options.previewName
  const calls: ContactStubCalls = {
    previews: [],
    resolves: [],
    registrations: [],
    logins: [],
  }
  let relationship: "none" | "pending_outgoing" | "connected" = "none"

  await page.route(`${AUTH_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === "/auth/register" && request.method() === "POST") {
      calls.registrations.push(request.postDataJSON())
      await fulfillJson(route, {
        accessToken: "e2e-access-token",
        refreshToken: "e2e-refresh-token",
        user: STUB_USER,
      })
      return
    }
    if (url.pathname === "/auth/login" && request.method() === "POST") {
      calls.logins.push(request.postDataJSON())
      await fulfillJson(route, {
        accessToken: "e2e-access-token",
        refreshToken: "e2e-refresh-token",
        user: STUB_USER,
      })
      return
    }
    if (url.pathname === "/auth/me") {
      await fulfillJson(route, { user: STUB_USER })
      return
    }
    await fulfillJson(route, { status: "ok" })
  })

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "")

    if (path === "/public/contact-preview") {
      calls.previews.push(request.postDataJSON())
      if (previewName) {
        await fulfillJson(route, { data: { displayName: previewName } })
      } else {
        await fulfillJson(
          route,
          {
            error: {
              message: "Contact preview not found",
              code: "CONTACT_PREVIEW_NOT_FOUND",
            },
          },
          404
        )
      }
      return
    }

    if (
      path === "/invite-links/resolve" ||
      path === "/qr-contact-tokens/resolve"
    ) {
      const body = request.postDataJSON() as { connect?: boolean }
      calls.resolves.push({
        path,
        body,
        auth: request.headers()["authorization"] ?? null,
      })
      // A live QR scan connects on the spot; an invite link, or a QR code
      // that ran out, only sends a request.
      const instant =
        path === "/qr-contact-tokens/resolve" && !options.qrExpired
      if (body.connect)
        relationship = instant ? "connected" : "pending_outgoing"
      await fulfillJson(route, {
        data: {
          profile: { ...INVITER, avatarUrl: null },
          relationship,
          canConnect: relationship === "none",
          expiresAt: "2099-01-01T00:00:00.000Z",
          expired: path === "/qr-contact-tokens/resolve" && !!options.qrExpired,
          connection: body.connect
            ? { processed: true, delivered: true, autoAccepted: instant }
            : null,
        },
      })
      return
    }

    if (path === "/notifications/unread-count") {
      await fulfillJson(route, { data: { count: 0 } })
      return
    }

    await fulfillJson(route, { data: [] })
  })

  return calls
}
