import {
  clearSession,
  getRefreshToken,
  getToken,
  getUser,
  setSession,
} from "./auth-store"

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

async function refreshSession(): Promise<string | null> {
  if (!AUTH_BASE) return null

  const refreshToken = getRefreshToken()
  const user = getUser()

  if (!refreshToken || !user) {
    clearSession()
    return null
  }

  const res = await fetch(`${AUTH_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) {
    clearSession()
    return null
  }

  const body = (await res.json()) as {
    accessToken: string
    refreshToken: string
  }
  setSession(body.accessToken, body.refreshToken, user)
  return body.accessToken
}

async function request<T>(
  baseUrl: string,
  path: string,
  opts: RequestOptions,
  hasRetried = false
): Promise<T> {
  if (!baseUrl) {
    throw new HttpError(0, `Missing base URL for request to ${path}`)
  }

  const headers: Record<string, string> = {}
  if (!opts.formData && opts.body !== undefined)
    headers["Content-Type"] = "application/json"
  if (opts.auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const timeoutMs = opts.timeoutMs ?? 12_000
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
      method: opts.method ?? "GET",
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
        !hasRetried &&
        path !== "/auth/refresh"
      ) {
        const nextAccessToken = await refreshSession()

        if (nextAccessToken) {
          return request<T>(baseUrl, path, opts, true)
        }
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
