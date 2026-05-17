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

  constructor(status: number, message: string, code?: string, details?: unknown) {
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
}

type ErrorResponse = {
  error?: {
    message?: string
    code?: string
    details?: unknown
  }
}

async function parseError(res: Response): Promise<ErrorResponse | null> {
  try {
    return (await res.json()) as ErrorResponse
  } catch {
    return null
  }
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

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.formData
      ? (opts.body as FormData)
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined,
    signal: opts.signal,
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

    const body = await parseError(res)
    throw new HttpError(
      res.status,
      body?.error?.message ?? res.statusText,
      body?.error?.code,
      body?.error?.details,
    )
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? ""
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

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
