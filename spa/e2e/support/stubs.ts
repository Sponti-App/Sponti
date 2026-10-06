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
  // The viewer's own answer; "going" marks a flare they joined.
  myRsvp?: "invited" | "going" | "declined" | null
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

/** Google's polyline format, the inverse of `decodePolyline` in routes-api.ts. */
function encodePolyline(path: Array<{ lat: number; lng: number }>): string {
  let out = ""
  let prevLat = 0
  let prevLng = 0
  const push = (delta: number) => {
    let v = delta < 0 ? ~(delta << 1) : delta << 1
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    out += String.fromCharCode(v + 63)
  }
  for (const { lat, lng } of path) {
    const e5Lat = Math.round(lat * 1e5)
    const e5Lng = Math.round(lng * 1e5)
    push(e5Lat - prevLat)
    push(e5Lng - prevLng)
    prevLat = e5Lat
    prevLng = e5Lng
  }
  return out
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
export type StubProfileIdentity = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export type StubUserProfile = {
  // bio, socials and mutualFriends are optional here and filled in as the api
  // does for a viewer who may not see them: null, null and zero (#288).
  profile: StubProfileIdentity & {
    bio?: string | null
    socials?: { instagram: string | null; telegram: string | null }
  }
  mutualFriends?: { count: number; preview: StubProfileIdentity[] }
  relationship:
    | "self"
    | "connected"
    | "pending_outgoing"
    | "pending_incoming"
    | "blocked"
    | "none"
  connectionId: string | null
}

/** One pin from GET /public/events/map (#425): nothing but what a pin needs. */
export type StubPublicPin = {
  _id: string
  type: string
  location: { type: "Point"; coordinates: [number, number] }
  startAt: string
  endAt: string
}

export function makeStubPublicPin(
  overrides: Partial<StubPublicPin> = {}
): StubPublicPin {
  const now = Date.now()
  return {
    _id: "public-e2e-1",
    type: "drinks",
    location: {
      type: "Point",
      coordinates: [STUB_COORDS.lng, STUB_COORDS.lat],
    },
    startAt: new Date(now - 10 * 60_000).toISOString(),
    endAt: new Date(now + 90 * 60_000).toISOString(),
    ...overrides,
  }
}

type StubBackendOptions = {
  /** Events returned by GET /events/map/active. Empty by default. */
  mapEvents?: StubApiEvent[]
  /**
   * Pins returned by the unauthenticated GET /public/events/map (#425), the
   * signed-out map's only flare data. Empty by default.
   */
  publicPins?: StubPublicPin[]
  /**
   * GET /events/:id answers with the map event of that id. Pass more here
   * for flares that aren't on the map. Any other id answers 404
   * EVENT_NOT_FOUND, like the api.
   */
  events?: StubApiEvent[]
  /** Profiles by username; any other username answers 404 USER_NOT_FOUND. */
  profiles?: Record<string, StubUserProfile>
  /**
   * The full mutual friends list per profile username, served in pages of
   * `limit` from GET /users/by-username/:username/mutual-friends.
   */
  mutualFriends?: Record<string, StubProfileIdentity[]>
  /** The signed-in user's own profile visibility. Public by default. */
  profileVisibility?: "public" | "private"
  /** Seeded last-known position. San Francisco by default. */
  coords?: { lat: number; lng: number }
  /**
   * The signed-in user's own bio and handles, as GET /auth/me returns them
   * (#289). All unset by default.
   */
  ownProfile?: Partial<StubOwnProfile>
  /**
   * Start signed out: no session is seeded, and POST /auth/register and
   * /auth/login answer with the stub user's tokens, so a test can drive the
   * real sign-in or sign-up form. Signed in by default.
   */
  signedOut?: boolean
  /**
   * How many accepted connections GET /connections lists. Zero by default.
   */
  friends?: number
  /**
   * The circles GET /circles lists, as the api returns them. Empty by
   * default. `memberCount` members are generated as `friend-0..n`, matching
   * the ids GET /connections uses.
   */
  circles?: Array<{
    _id: string
    name: string
    type: "inner" | "close" | "all" | "custom"
    memberCount: number
  }>
}

/** The self-authored fields GET /auth/me and PATCH /auth/me/profile carry. */
export type StubOwnProfile = {
  bio: string | null
  instagram: string | null
  telegram: string | null
}

/** What `stubBackend` hands back for the test to assert on. */
export type StubBackendHandle = {
  /** Body of every PATCH /auth/me/profile the app sent, in order. */
  profilePatches: Array<Record<string, unknown>>
}

// A light stand-in for auth-server's profile field rules (profileFields.ts):
// enough to accept "@x" and pasted links, and to refuse a handle with
// characters no network allows, with the validator's message shape.
function stubNormalizeHandle(raw: string, network: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const handle = trimmed
    .replace(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|t\.me)\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "")
    .toLowerCase()
  if (!/^[a-z0-9._]{1,32}$/.test(handle)) {
    throw new Error(`${network} handle is not valid`)
  }
  return handle
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
): Promise<StubBackendHandle> {
  const profilePatches: Array<Record<string, unknown>> = []
  const ownProfile: StubOwnProfile = {
    bio: null,
    instagram: null,
    telegram: null,
    ...options.ownProfile,
  }
  const mapEvents = options.mapEvents ?? []
  const eventsById = new Map(
    [...mapEvents, ...(options.events ?? [])].map((e) => [e._id, e])
  )
  const profiles = options.profiles ?? {}
  const mutualFriendLists = options.mutualFriends ?? {}
  const user = {
    ...STUB_USER,
    profileVisibility: options.profileVisibility ?? STUB_USER.profileVisibility,
  }
  const coords = options.coords ?? STUB_COORDS
  const signedOut = options.signedOut ?? false
  const connections = Array.from({ length: options.friends ?? 0 }, (_, i) => ({
    _id: `conn-${i}`,
    requesterId: user.id,
    receiverId: `friend-${i}`,
    status: "accepted",
    otherUser: { _id: `friend-${i}`, username: `friend${i}` },
  }))

  await page.addInitScript(
    ({
      accessTokenKey,
      refreshTokenKey,
      userKey,
      coordsKey,
      user,
      coords,
      signedOut,
    }) => {
      if (!signedOut) {
        window.localStorage.setItem(accessTokenKey, "e2e-access-token")
        window.localStorage.setItem(refreshTokenKey, "e2e-refresh-token")
        window.localStorage.setItem(userKey, JSON.stringify(user))
      }
      window.localStorage.setItem(coordsKey, JSON.stringify(coords))
    },
    {
      accessTokenKey: ACCESS_TOKEN_KEY,
      refreshTokenKey: REFRESH_TOKEN_KEY,
      userKey: USER_KEY,
      coordsKey: LAST_KNOWN_COORDS_KEY,
      user,
      coords,
      signedOut,
    }
  )

  await page.route(`${AUTH_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())

    if (
      route.request().method() === "POST" &&
      (url.pathname === "/auth/register" || url.pathname === "/auth/login")
    ) {
      await fulfillJson(route, {
        accessToken: "e2e-access-token",
        refreshToken: "e2e-refresh-token",
        user: { ...user, ...ownProfile },
      })
      return
    }
    if (url.pathname === "/auth/me") {
      await fulfillJson(route, { user: { ...user, ...ownProfile } })
      return
    }
    if (
      url.pathname === "/auth/me/profile" &&
      route.request().method() === "PATCH"
    ) {
      const body = route.request().postDataJSON() as Record<string, unknown>
      profilePatches.push(body)
      try {
        for (const name of ["bio", "instagram", "telegram"] as const) {
          const raw = body[name]
          if (raw === undefined) continue
          if (raw !== null && typeof raw !== "string")
            throw new Error(`${name} is not valid`)
          ownProfile[name] =
            name === "bio"
              ? (raw ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim() || null
              : stubNormalizeHandle(raw ?? "", name)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "invalid"
        const field = message.split(" ")[0]
        await fulfillJson(
          route,
          { message: `✖ ${message}\n  → at ${field}` },
          400
        )
        return
      }
      await fulfillJson(route, { user: { ...user, ...ownProfile } })
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
    if (path === "/public/events/map" && route.request().method() === "GET") {
      await fulfillJson(route, { data: options.publicPins ?? [] })
      return
    }
    if (path === "/connections" && route.request().method() === "GET") {
      await fulfillJson(route, {
        data: connections,
        pagination: {
          page: 1,
          limit: 100,
          total: connections.length,
          totalPages: 1,
        },
      })
      return
    }
    if (path === "/circles" && route.request().method() === "GET") {
      await fulfillJson(route, {
        data: (options.circles ?? []).map((circle) => ({
          _id: circle._id,
          ownerId: user.id,
          name: circle.name,
          type: circle.type,
          members: Array.from({ length: circle.memberCount }, (_, i) => ({
            _id: `${circle._id}-m${i}`,
            circleId: circle._id,
            ownerId: user.id,
            userId: `friend-${i}`,
          })),
        })),
      })
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
      // A fixed 10 min, 800 m walk, drawn from the origin through a bend to
      // the destination the app asked for (spa/lib/routes-api.ts decodes it).
      const { origin, destination } = route.request().postDataJSON() as {
        origin: { lat: number; lng: number }
        destination: { lat: number; lng: number }
      }
      const bend = { lat: destination.lat, lng: origin.lng + 0.001 }
      await fulfillJson(route, {
        data: {
          encodedPolyline: encodePolyline([origin, bend, destination]),
          durationSeconds: 600,
          distanceMeters: 800,
        },
      })
      return
    }
    const mutualMatch = path.match(
      /^\/users\/by-username\/([^/]+)\/mutual-friends$/
    )
    if (mutualMatch) {
      const all = mutualFriendLists[decodeURIComponent(mutualMatch[1])] ?? []
      const page = Number(url.searchParams.get("page") ?? 1)
      const limit = Number(url.searchParams.get("limit") ?? 20)
      await fulfillJson(route, {
        data: all.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total: all.length,
          totalPages: Math.ceil(all.length / limit),
        },
      })
      return
    }
    const profileMatch = path.match(/^\/users\/by-username\/([^/]+)$/)
    if (profileMatch) {
      const profile = profiles[decodeURIComponent(profileMatch[1])]
      if (profile) {
        await fulfillJson(route, {
          data: {
            ...profile,
            profile: {
              bio: null,
              socials: { instagram: null, telegram: null },
              ...profile.profile,
            },
            mutualFriends: profile.mutualFriends ?? { count: 0, preview: [] },
          },
        })
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
      } else {
        // The api's answer for a flare that doesn't exist or isn't visible
        // (eventService.getEventById, through the error handler).
        await fulfillJson(
          route,
          { error: { message: "Event not found", code: "EVENT_NOT_FOUND" } },
          404
        )
      }
      return
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

  return { profilePatches }
}
