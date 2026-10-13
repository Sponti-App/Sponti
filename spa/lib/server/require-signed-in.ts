import { createHash } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

// #541: the places and geocode routes spend the server's Google key, so only
// a signed-in user may call them. This app has no copy of the token signing
// secret (it lives only on the backends), so the token is checked by asking
// the auth-server who it belongs to.

export type SignedInResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 429 | 503; message: string; retryAfter?: number }

export const SIGNED_IN_CACHE_MS = 60_000
export const SIGNED_IN_CACHE_MAX = 1_000
export const USER_LIMIT_WINDOW_MS = 60_000
export const USER_LIMIT_MAX = 120
const AUTH_CHECK_TIMEOUT_MS = 5_000

const verified = new Map<string, { userId: string; expiresAt: number }>()
const windows = new Map<string, { count: number; resetsAt: number }>()

/** The auth-server's absolute URL: the first http(s) entry of the shared
 * base-URL setting (it may also list a relative dev proxy path). */
function authBaseUrl(): string | null {
  const candidates = (process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? "")
    .split(",")
    .map((candidate) => candidate.trim().replace(/\/+$/, ""))
  return candidates.find((candidate) => /^https?:\/\//.test(candidate)) ?? null
}

function prune(now: number) {
  for (const [key, entry] of verified) {
    if (entry.expiresAt <= now) verified.delete(key)
  }
  for (const [key, entry] of windows) {
    if (entry.resetsAt <= now) windows.delete(key)
  }
  // Still full of live entries: drop the oldest so the maps cannot grow
  // without bound.
  while (verified.size >= SIGNED_IN_CACHE_MAX) {
    const oldest = verified.keys().next().value
    if (oldest === undefined) break
    verified.delete(oldest)
  }
  while (windows.size >= SIGNED_IN_CACHE_MAX) {
    const oldest = windows.keys().next().value
    if (oldest === undefined) break
    windows.delete(oldest)
  }
}

async function lookUpUser(token: string): Promise<SignedInResult> {
  const base = authBaseUrl()
  if (!base) {
    console.error("[auth-check] NEXT_PUBLIC_AUTH_BASE_URL has no absolute URL")
    return { ok: false, status: 503, message: "sign-in check unavailable" }
  }

  let resp: Response
  try {
    resp = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(AUTH_CHECK_TIMEOUT_MS),
    })
  } catch (err) {
    console.error("[auth-check] auth-server unreachable", err)
    return { ok: false, status: 503, message: "sign-in check unavailable" }
  }

  if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
    return { ok: false, status: 401, message: "sign in to use this" }
  }
  if (!resp.ok) {
    console.error(`[auth-check] auth-server answered ${resp.status}`)
    return { ok: false, status: 503, message: "sign-in check unavailable" }
  }

  try {
    const body = (await resp.json()) as { user?: { id?: unknown } }
    const id = body.user?.id
    if (typeof id === "string" && id !== "") return { ok: true, userId: id }
  } catch {
    // Falls through to the unavailable answer below.
  }
  console.error("[auth-check] unexpected /auth/me payload")
  return { ok: false, status: 503, message: "sign-in check unavailable" }
}

/**
 * Lets the request through only for a signed-in user, and caps how often one
 * user can call. The cap and the cache are per server instance, so it is a
 * brake on one account hammering the routes, not an exact quota; Google's own
 * quota and budget alerts are the hard ceiling (#128).
 */
export async function requireSignedIn(
  req: NextRequest,
  now: number = Date.now()
): Promise<SignedInResult> {
  const header = req.headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer ") || header.length === "Bearer ".length) {
    return { ok: false, status: 401, message: "sign in to use this" }
  }
  const token = header.slice("Bearer ".length)

  const cacheKey = createHash("sha256").update(token).digest("hex")
  let userId: string
  const cached = verified.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    userId = cached.userId
  } else {
    const result = await lookUpUser(token)
    if (!result.ok) return result
    userId = result.userId
    prune(now)
    verified.set(cacheKey, { userId, expiresAt: now + SIGNED_IN_CACHE_MS })
  }

  const entry = windows.get(userId)
  if (!entry || entry.resetsAt <= now) {
    windows.set(userId, { count: 1, resetsAt: now + USER_LIMIT_WINDOW_MS })
  } else if (entry.count >= USER_LIMIT_MAX) {
    return {
      ok: false,
      status: 429,
      message: "too many requests, try again in a minute",
      retryAfter: Math.max(1, Math.ceil((entry.resetsAt - now) / 1000)),
    }
  } else {
    entry.count += 1
  }

  return { ok: true, userId }
}

export function signedInDenied(
  result: Extract<SignedInResult, { ok: false }>,
  body: Record<string, unknown>
) {
  return NextResponse.json(
    { ...body, error: result.message },
    {
      status: result.status,
      headers: result.retryAfter
        ? { "Retry-After": String(result.retryAfter) }
        : undefined,
    }
  )
}

/** Test seam: forget the cache and counters. */
export function resetSignedInState() {
  verified.clear()
  windows.clear()
}
