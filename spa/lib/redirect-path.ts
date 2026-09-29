"use client"

import { useSyncExternalStore } from "react"

// Where a signed-out user is sent, and where they're returned after signing
// in (#219). Shared by AuthGate and the auth pages so the rules can't drift.

export const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]

export const REDIRECT_PARAM = "redirectTo"

// Placeholder origin used only to parse a relative path; any value whose
// parsed origin differs from it points off-site.
const PARSE_ORIGIN = "http://sponti.invalid"

/**
 * Returns `value` if it is a same-app path that's safe to navigate to after
 * signing in, otherwise "/". Rejects absolute URLs, protocol-relative URLs
 * (`//evil.com`), backslash tricks (`/\evil.com`, which browsers read as
 * `//evil.com`), and the auth pages themselves (which would loop).
 */
export function getSafeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/"
  // Backslashes and control characters have no business in an app path and
  // are how open-redirect payloads usually slip past a "starts with /" check.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/"

  let url: URL
  try {
    url = new URL(value, PARSE_ORIGIN)
  } catch {
    return "/"
  }
  if (url.origin !== PARSE_ORIGIN) return "/"
  if (AUTH_PATHS.includes(url.pathname)) return "/"
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * The login URL for a signed-out user who tried to open `path` (pathname plus
 * query). The home screen needs no return trip, so it gets a bare `/login`.
 */
export function buildLoginPath(path: string): string {
  const safe = getSafeRedirectPath(path)
  if (safe === "/") return "/login"
  return `/login?${REDIRECT_PARAM}=${encodeURIComponent(safe)}`
}

function readRedirectParam(): string | null {
  return new URLSearchParams(window.location.search).get(REDIRECT_PARAM)
}

/** The validated post-sign-in destination from the current URL. */
export function getRedirectTarget(): string {
  if (typeof window === "undefined") return "/"
  return getSafeRedirectPath(readRedirectParam())
}

const noopSubscribe = () => () => {}

/**
 * `?redirectTo=…` to append to links between the auth pages, so switching
 * from sign-in to register (or back) keeps the page the user was heading to.
 * Empty on the server and during hydration, which keeps the markup stable.
 */
export function useRedirectQuery(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const target = getSafeRedirectPath(readRedirectParam())
      return target === "/"
        ? ""
        : `?${REDIRECT_PARAM}=${encodeURIComponent(target)}`
    },
    () => ""
  )
}
