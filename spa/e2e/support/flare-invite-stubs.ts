import type { Page, Route } from "@playwright/test"
import { API_BASE } from "./stubs"

// #616: a flare's own invite link. Answers the five endpoints behind it on top
// of whatever `stubBackend` already stubs (a later `page.route` runs first and
// hands everything else on with `fallback()`), and records what the app asked.

export const INVITE_TOKEN = "flare_token-e2e-0123456789abcdefghijklmnopqrstu"
export const INVITE_RESET_TOKEN = "flare_token-e2e-reset-9876543210zyxwvutsrqp"

export type StubFlareInvitePreview = {
  host: { displayName: string; avatarUrl: string | null }
  title: string
  type: string
  startAt: string
  endAt: string
  placeName: string
}

export type StubFlareInviteState =
  | "host"
  | "going"
  | "invited"
  | "waiting"
  | "none"

type FlareInviteStubOptions = {
  /** What the public preview shows; null answers 404, like a dead link. */
  preview?: StubFlareInvitePreview | null
  /** What redeeming answers. */
  redeem?: { state: StubFlareInviteState; eventId: string | null }
  /** What the status read answers before anything is redeemed. */
  status?: { state: StubFlareInviteState; eventId: string | null }
}

export type FlareInviteStubCalls = {
  previews: Array<{ body: unknown; auth: string | null }>
  statuses: Array<{ body: unknown; auth: string | null }>
  redeems: Array<{ body: unknown; auth: string | null }>
  hostLinkReads: string[]
  hostLinkResets: string[]
}

export function makeStubInvitePreview(
  overrides: Partial<StubFlareInvitePreview> = {}
): StubFlareInvitePreview {
  const now = Date.now()
  return {
    host: { displayName: "Patrick Caire", avatarUrl: null },
    title: "drinks at klunkerkranich",
    type: "drinks",
    startAt: new Date(now + 26 * 3_600_000).toISOString(),
    endAt: new Date(now + 29 * 3_600_000).toISOString(),
    placeName: "klunkerkranich",
    ...overrides,
  }
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

export async function stubFlareInvite(
  page: Page,
  options: FlareInviteStubOptions = {}
): Promise<FlareInviteStubCalls> {
  const preview =
    options.preview === undefined ? makeStubInvitePreview() : options.preview
  const calls: FlareInviteStubCalls = {
    previews: [],
    statuses: [],
    redeems: [],
    hostLinkReads: [],
    hostLinkResets: [],
  }
  let current = options.status ?? { state: "none", eventId: null }

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "")
    const auth = request.headers()["authorization"] ?? null

    if (path === "/public/flare-invite-preview") {
      calls.previews.push({ body: request.postDataJSON(), auth })
      if (!preview) {
        await json(
          route,
          { error: { message: "gone", code: "FLARE_INVITE_NOT_FOUND" } },
          404
        )
        return
      }
      await json(route, { data: preview })
      return
    }

    if (path === "/flare-invites/status" || path === "/flare-invites/redeem") {
      const redeeming = path === "/flare-invites/redeem"
      ;(redeeming ? calls.redeems : calls.statuses).push({
        body: request.postDataJSON(),
        auth,
      })
      if (redeeming && options.redeem) current = options.redeem
      await json(route, {
        data: {
          state: current.state,
          eventId: current.eventId,
          preview: preview ?? makeStubInvitePreview(),
        },
      })
      return
    }

    const link = path.match(/^\/events\/([^/]+)\/invite-link(\/reset)?$/)
    if (link) {
      const [, eventId, reset] = link
      if (reset) {
        calls.hostLinkResets.push(eventId)
        await json(route, { data: { token: INVITE_RESET_TOKEN } }, 201)
        return
      }
      calls.hostLinkReads.push(eventId)
      await json(route, { data: { token: INVITE_TOKEN } })
      return
    }

    await route.fallback()
  })

  return calls
}
