import {
  clearSession,
  getRefreshToken,
  getToken,
  getUser,
  setSession,
} from "./auth-store"

// A warm backend answers in well under this. #171: Render's free tier puts
// idle services to sleep, and the first request after that can take 30-60s
// to wake one up, so a plain request gets one longer retry (GETs only —
// see `request`) before it's treated as a real failure.
export const DEFAULT_TIMEOUT_MS = 15_000
export const COLD_START_TIMEOUT_MS = 45_000

export class HttpError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown
  ) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
    this.details = details
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
  formData?: boolean
  timeoutMs?: number
}

type ErrorPayload = {
  message: string
  code?: string
  details?: unknown
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined
}

/**
 * Normalises the two error envelopes this app has to deal with.
 *
 * `api/` wraps errors as `{ error: { message, code, details } }`, while
 * `auth-server/`'s error handler emits a flat `{ message }`. Reading only the
 * nested form discarded every message the auth server sent and fell back to the
 * HTTP status text, so a wrong password surfaced as "Unauthorized" rather than
 * "Invalid email or password" — which reads as a broken app, not a typo.
 */
export function extractErrorPayload(
  body: unknown,
  fallbackMessage: string
): ErrorPayload {
  if (!body || typeof body !== "object") {
    return { message: fallbackMessage }
  }

  const flat = body as Record<string, unknown>
  const nested =
    flat.error && typeof flat.error === "object"
      ? (flat.error as Record<string, unknown>)
      : undefined

  return {
    message:
      asNonEmptyString(nested?.message) ??
      asNonEmptyString(flat.message) ??
      fallbackMessage,
    code: asNonEmptyString(nested?.code) ?? asNonEmptyString(flat.code),
    details: nested?.details ?? flat.details,
  }
}

async function parseError(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

function matchesCurrentHost(candidateUrl: URL): boolean {
  if (typeof window === "undefined") return false

  const currentHost = window.location.hostname
  return (
    candidateUrl.hostname === currentHost ||
    (isLoopbackHost(candidateUrl.hostname) && isLoopbackHost(currentHost))
  )
}

function rewriteLoopbackHost(candidateUrl: URL): string | null {
  if (typeof window === "undefined") return null

  const currentHost = window.location.hostname
  if (isLoopbackHost(currentHost) || !isLoopbackHost(candidateUrl.hostname)) {
    return null
  }

  const rewritten = new URL(candidateUrl.toString())
  rewritten.hostname = currentHost
  return rewritten.toString()
}

export function resolveConfiguredBaseUrl(rawValue: string): string {
  const candidates = rawValue
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)

  if (candidates.length === 0) return ""

  if (typeof window === "undefined") return candidates[0]

  for (const candidate of candidates) {
    try {
      const candidateUrl = new URL(candidate)
      if (matchesCurrentHost(candidateUrl)) return candidate
    } catch {
      continue
    }
  }

  for (const candidate of candidates) {
    try {
      const candidateUrl = new URL(candidate)
      const rewritten = rewriteLoopbackHost(candidateUrl)
      if (rewritten) return rewritten
    } catch {
      continue
    }
  }

  return candidates[0]
}

type RefreshOutcome =
  | { status: "ok"; accessToken: string }
  // The refresh token really is invalid/expired — the session was cleared.
  | { status: "invalid" }
  // 5xx, a network error, or a client-side timeout — the session is kept;
  // the request that triggered this surfaces its own error instead.
  | { status: "error" }

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

async function postRefresh(
  refreshToken: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${AUTH_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

// Cross-tab race guard (#167): both tabs of the same account hold the same
// refresh token in localStorage. If this tab is about to spend it, a
// `storage` event from another tab that got there first means a fresh pair
// is already sitting in storage — wait briefly for it instead of racing the
// single-use token against the other tab.
function waitForTokenRotation(
  previousRefreshToken: string,
  timeoutMs = 1500
): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null)

  return new Promise((resolve) => {
    const onStorage = () => check()

    const timeoutId = window.setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)

    const cleanup = () => {
      window.removeEventListener("storage", onStorage)
      window.clearTimeout(timeoutId)
    }

    function check(): boolean {
      const current = getRefreshToken()
      if (current && current !== previousRefreshToken) {
        cleanup()
        resolve(getToken())
        return true
      }
      return false
    }

    window.addEventListener("storage", onStorage)
    check()
  })
}

// Only one refresh runs at a time per tab. Every 401 that arrives while one
// is in flight awaits this same promise instead of spending the single-use
// refresh token again (#167).
let inFlightRefresh: Promise<RefreshOutcome> | null = null

async function refreshSession(
  failedAccessToken: string | null
): Promise<RefreshOutcome> {
  if (!AUTH_BASE) return { status: "invalid" }

  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh(failedAccessToken).finally(() => {
      inFlightRefresh = null
    })
  }
  return inFlightRefresh
}

async function performRefresh(
  failedAccessToken: string | null
): Promise<RefreshOutcome> {
  const refreshToken = getRefreshToken()
  const user = getUser()

  if (!refreshToken || !user) {
    clearSession()
    return { status: "invalid" }
  }

  // Someone else (another request in this tab, deduped above, or another
  // tab) may have already rotated the pair by the time we get here. Re-read
  // storage before spending another single-use refresh token.
  const currentAccessToken = getToken()
  if (
    failedAccessToken &&
    currentAccessToken &&
    currentAccessToken !== failedAccessToken
  ) {
    return { status: "ok", accessToken: currentAccessToken }
  }

  let res: Response
  try {
    res = await postRefresh(refreshToken, DEFAULT_TIMEOUT_MS)
  } catch (err) {
    if (!isAbortError(err)) return { status: "error" }
    // Cold start (#171): give the refresh one longer, second attempt before
    // treating it as a network failure.
    try {
      res = await postRefresh(refreshToken, COLD_START_TIMEOUT_MS)
    } catch {
      return { status: "error" }
    }
  }

  if (res.status === 401 || res.status === 403) {
    // Our token may have just been consumed by another tab's refresh that
    // raced ahead of us. Give the storage write a brief window to land
    // before treating this as a genuinely invalid session.
    const rotatedAccessToken = await waitForTokenRotation(refreshToken)
    if (rotatedAccessToken) {
      return { status: "ok", accessToken: rotatedAccessToken }
    }
    clearSession()
    return { status: "invalid" }
  }

  if (!res.ok) {
    // 5xx or anything unexpected — keep the session, this request fails.
    return { status: "error" }
  }

  const body = (await res.json()) as {
    accessToken: string
    refreshToken: string
  }
  setSession(body.accessToken, body.refreshToken, user)
  return { status: "ok", accessToken: body.accessToken }
}

type RetryState = {
  // A 401 was already retried once against a fresh access token.
  hasRetriedAuth?: boolean
  // A client-side timeout was already retried once with a longer window.
  hasRetriedTimeout?: boolean
}

async function request<T>(
  baseUrl: string,
  path: string,
  opts: RequestOptions,
  state: RetryState = {}
): Promise<T> {
  if (!baseUrl) {
    throw new HttpError(0, `Missing base URL for request to ${path}`)
  }

  const headers: Record<string, string> = {}
  if (!opts.formData && opts.body !== undefined)
    headers["Content-Type"] = "application/json"
  let usedAccessToken: string | null = null
  if (opts.auth) {
    usedAccessToken = getToken()
    if (usedAccessToken) headers.Authorization = `Bearer ${usedAccessToken}`
  }

  const method = opts.method ?? "GET"
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const requestController = new AbortController()
  const timeoutId = window.setTimeout(
    () => requestController.abort(),
    timeoutMs
  )

  const handleExternalAbort = () => requestController.abort()
  if (opts.signal) {
    if (opts.signal.aborted) {
      requestController.abort()
    } else {
      opts.signal.addEventListener("abort", handleExternalAbort, { once: true })
    }
  }

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: opts.formData
        ? (opts.body as FormData)
        : opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
      signal: requestController.signal,
    })

    if (!res.ok) {
      if (
        opts.auth &&
        res.status === 401 &&
        !state.hasRetriedAuth &&
        path !== "/auth/refresh"
      ) {
        const refreshResult = await refreshSession(usedAccessToken)

        if (refreshResult.status === "ok") {
          return request<T>(baseUrl, path, opts, {
            ...state,
            hasRetriedAuth: true,
          })
        }

        if (refreshResult.status === "error") {
          // A 5xx or network/timeout failure refreshing — the session is
          // still good, so don't sign the user out. Surface a distinct
          // error for this one request instead of the misleading
          // "Unauthorized" the original 401 carries (#167).
          throw new HttpError(
            0,
            "Couldn't refresh your session — try again",
            "SESSION_REFRESH_FAILED"
          )
        }
        // "invalid" — the refresh token really is bad and the session was
        // cleared. Fall through and throw the original 401 below.
      }

      const payload = extractErrorPayload(await parseError(res), res.statusText)
      throw new HttpError(
        res.status,
        payload.message,
        payload.code,
        payload.details
      )
    }

    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  } catch (error) {
    if (requestController.signal.aborted) {
      if (opts.signal?.aborted) {
        throw new HttpError(0, `Request to ${path} was cancelled`)
      }

      // Cold start (#171): a Render free-tier instance can take 30-60s to
      // wake from idle. Retrying a non-idempotent request blindly could
      // duplicate a side effect, so only GETs (and internally, the refresh
      // call — see postRefresh) get the extra, longer attempt.
      if (method === "GET" && !state.hasRetriedTimeout) {
        return request<T>(
          baseUrl,
          path,
          { ...opts, timeoutMs: COLD_START_TIMEOUT_MS },
          { ...state, hasRetriedTimeout: true }
        )
      }

      throw new HttpError(0, `Request to ${path} timed out`)
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    if (opts.signal)
      opts.signal.removeEventListener("abort", handleExternalAbort)
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "")
}

function normalizeApiBaseUrl(value: string): string {
  return normalizeBaseUrl(value).replace(/\/api\/v1$/, "")
}
const AUTH_BASE = normalizeBaseUrl(
  resolveConfiguredBaseUrl(process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? "")
)
const API_BASE = normalizeApiBaseUrl(
  resolveConfiguredBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
)

function withApiVersionPrefix(path: string): string {
  if (path.startsWith("/api/v1")) return path
  return `/api/v1${path.startsWith("/") ? path : `/${path}`}`
}

export function authFetch<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  return request<T>(AUTH_BASE, path, opts)
}

export function apiFetch<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  return request<T>(API_BASE, withApiVersionPrefix(path), {
    auth: true,
    ...opts,
  })
}
