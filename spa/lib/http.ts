import { getToken } from "./auth-store"

export class HttpError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
}

async function request<T>(baseUrl: string, path: string, opts: RequestOptions): Promise<T> {
  if (!baseUrl) {
    throw new HttpError(0, `Missing base URL for request to ${path}`)
  }

  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  if (opts.auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  })

  if (!res.ok) {
    let body: { message?: string; code?: string } | null = null
    try {
      body = (await res.json()) as { message?: string; code?: string }
    } catch {
      // non-JSON error body — fall through to statusText
    }
    throw new HttpError(res.status, body?.message ?? res.statusText, body?.code)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? ""
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export function authFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(AUTH_BASE, path, opts)
}

export function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(API_BASE, path, { auth: true, ...opts })
}
