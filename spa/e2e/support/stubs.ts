import type { Page, Route } from "@playwright/test"

// Mirrors playwright.config.ts's webServer env — kept in one place so a
// config change can't silently desync the routes we stub here.
export const AUTH_BASE = "http://stub-auth.sponti.test"
export const API_BASE = "http://stub-api.sponti.test"

// localStorage keys from spa/lib/auth-store.ts.
const ACCESS_TOKEN_KEY = "sponti.auth.access-token.v1"
const REFRESH_TOKEN_KEY = "sponti.auth.refresh-token.v1"
const USER_KEY = "sponti.auth.user.v1"
// spa/lib/geolocation.ts. Seeding this stands in for a granted geolocation
// permission so the map has a camera center immediately, without needing to
// drive the browser's real permission prompt in a headless run.
const LAST_KNOWN_COORDS_KEY = "sponti.geo.last-known-coords.v1"

export const STUB_USER = {
  id: "user-e2e-1",
  username: "flaretester",
  displayName: "Flare Tester",
  email: "flaretester@example.com",
  profileVisibility: "public" as const,
  socialBattery: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const STUB_COORDS = { lat: 37.7749, lng: -122.4194 } // San Francisco
// Humboldthain, for the berlin-only idea list (#243).
export const BERLIN_COORDS = { lat: 52.5474, lng: 13.3873 }

/** Minimal `ApiEvent` shape (see spa/lib/api/events/events.types.ts). */
export type StubApiEvent = {
  _id: string
  // A bare id, or the populated host identity the api attaches (#199 links
  // the host by username).
  hostId:
    | string
    | {
        _id: string
        username?: string
        displayName?: string
        avatarUrl?: string | null
      }
  title: string
  type: string
  startAt: string
  endAt: string
  locationName: string
  location: { type: "Point"; coordinates: [number, number] }
  visibility: "public" | "private"
  allowGuestInvites: "multiple" | "single" | "none"
  guestInviteLimit: number
  status: "active" | "cancelled" | "completed"
  goingCount?: number
  // Going guests, as the api's `attachEventPeople` sends them (#265 links
  // each by username). ETA fields only ever reach the host.
  attendees?: Array<{
    _id: string
    displayName?: string
    username?: string
    avatarUrl?: string | null
    willArriveAt?: string | null
    arrivalStatus?: "on_time" | "running_late" | null
  }>
}

export function makeStubFlare(
  overrides: Partial<StubApiEvent> = {}
): StubApiEvent {
  const now = Date.now()
  return {
    _id: "event-e2e-1",
    hostId: "user-e2e-host",
    title: "drinks after work",
    type: "drinks",
    startAt: new Date(now - 10 * 60_000).toISOString(),
    endAt: new Date(now + 90 * 60_000).toISOString(),
    locationName: "the usual spot",
    location: {
      type: "Point",
      coordinates: [STUB_COORDS.lng, STUB_COORDS.lat],
    },
    visibility: "public",
    allowGuestInvites: "none",
    guestInviteLimit: 0,
    status: "active",
    goingCount: 2,
    ...overrides,
  }
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

/** `GET /users/by-username/:username` body (see spa/lib/api/users.ts). */
export type StubUserProfile = {
  profile: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  relationship:
    | "self"
    | "connected"
    | "pending_outgoing"
    | "pending_incoming"
    | "blocked"
    | "none"
  connectionId: string | null
}

type StubBackendOptions = {
  /** Events returned by GET /events/map/active. Empty by default. */
  mapEvents?: StubApiEvent[]
  /**
   * GET /events/:id answers with the map event of that id. Pass more here
   * for flares that aren't on the map.
   */
  events?: StubApiEvent[]
  /** Profiles by username; any other username answers 404 USER_NOT_FOUND. */
  profiles?: Record<string, StubUserProfile>
  /** Seeded last-known position. San Francisco by default. */
  coords?: { lat: number; lng: number }
}

/**
 * Seeds a logged-in session and stubs every request to the auth/api base
 * URLs the app is built against (see playwright.config.ts's webServer env
 * and spa/lib/http.ts's resolution of NEXT_PUBLIC_AUTH_BASE_URL /
 * NEXT_PUBLIC_API_BASE_URL). Nothing here ever reaches a real server — the
 * base URLs aren't resolvable hosts, and every request to them is answered
 * by page.route.
 *
 * Call before the first `page.goto`.
 */
export async function stubBackend(
  page: Page,
  options: StubBackendOptions = {}
): Promise<void> {
  const mapEvents = options.mapEvents ?? []
  const eventsById = new Map(
    [...mapEvents, ...(options.events ?? [])].map((e) => [e._id, e])
  )
  const profiles = options.profiles ?? {}
  const coords = options.coords ?? STUB_COORDS

  await page.addInitScript(
    ({ accessTokenKey, refreshTokenKey, userKey, coordsKey, user, coords }) => {
      window.localStorage.setItem(accessTokenKey, "e2e-access-token")
      window.localStorage.setItem(refreshTokenKey, "e2e-refresh-token")
      window.localStorage.setItem(userKey, JSON.stringify(user))
      window.localStorage.setItem(coordsKey, JSON.stringify(coords))
    },
    {
      accessTokenKey: ACCESS_TOKEN_KEY,
      refreshTokenKey: REFRESH_TOKEN_KEY,
      userKey: USER_KEY,
      coordsKey: LAST_KNOWN_COORDS_KEY,
      user: STUB_USER,
      coords,
    }
  )

  await page.route(`${AUTH_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === "/auth/me") {
      await fulfillJson(route, { user: STUB_USER })
      return
    }
    if (url.pathname === "/health") {
      await fulfillJson(route, { status: "ok" })
      return
    }

    // Anything else on the auth host is unexpected in this smoke suite —
    // answer with an empty-but-valid body rather than letting the request
    // hang, so an unstubbed call fails the test's own assertions instead of
    // timing out the whole run.
    await fulfillJson(route, {})
  })

  await page.route(`${API_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api\/v1/, "")

    if (path === "/events/map/active") {
      await fulfillJson(route, { data: mapEvents })
      return
    }
    if (path === "/events/calendar/upcoming") {
      await fulfillJson(route, {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      return
    }
    if (path === "/events/mine/upcoming") {
      await fulfillJson(route, { data: { hostedByMe: [], invited: [] } })
      return
    }
    if (path === "/notifications/unread-count") {
      await fulfillJson(route, { data: { count: 0 } })
      return
    }
    if (path === "/notifications") {
      await fulfillJson(route, { data: [], pagination: { nextCursor: null } })
      return
    }
    if (path === "/notification-settings/me") {
      await fulfillJson(route, {
        data: {
          pushEnabled: false,
          quietHoursStart: null,
          quietHoursEnd: null,
        },
      })
      return
    }
    if (path === "/health") {
      await fulfillJson(route, { status: "ok" })
      return
    }
    if (path === "/maps/route") {
      // What the api answers with no Google key: the SPA falls back to a
      // straight line instead of decoding a polyline that isn't there.
      await fulfillJson(
        route,
        {
          error: { message: "Routes unavailable", code: "ROUTES_UNAVAILABLE" },
        },
        503
      )
      return
    }
    const profileMatch = path.match(/^\/users\/by-username\/([^/]+)$/)
    if (profileMatch) {
      const profile = profiles[decodeURIComponent(profileMatch[1])]
      if (profile) {
        await fulfillJson(route, { data: profile })
      } else {
        await fulfillJson(
          route,
          { error: { message: "User not found", code: "USER_NOT_FOUND" } },
          404
        )
      }
      return
    }
    const eventMatch = path.match(/^\/events\/([^/]+)$/)
    if (route.request().method() === "GET" && eventMatch) {
      const event = eventsById.get(eventMatch[1])
      if (event) {
        await fulfillJson(route, { data: event })
        return
      }
    }
    if (route.request().method() === "POST" && path === "/events") {
      await fulfillJson(
        route,
        { data: makeStubFlare({ title: "new flare" }) },
        201
      )
      return
    }

    // Generic fallback for anything not explicitly modeled above (circles,
    // connections, etc. if a test happens to touch them) — an empty list is
    // a safe default for the list-shaped endpoints this app mostly has.
    await fulfillJson(route, { data: [] })
  })
}
