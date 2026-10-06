import { LEGAL_PATHS } from "@/lib/legal-paths"

// #467 part 1: the landing page on the apex (sponti.fun) and the app on its
// own origin (e.g. app.sponti.fun), from one Vercel project. proxy.ts asks
// `routeLandingHost` what to do with each request.
//
// On a landing host (LANDING_HOSTS, comma-separated):
//   /             → rewrite to the landing route (/landing)
//   /landing      → served here too (no redirect: behind a proxy the request
//                   url may not carry the public host)
//   legal paths   → served here (the impressum must be reachable)
//   link previews → served here (/opengraph-image, /twitter-image)
//   anything else → redirect to APP_ORIGIN with the same path and query, so
//                   old links such as sponti.fun/invite/<token> keep working
//
// With either variable unset or invalid (localhost, the dev alias, today's
// production), every request passes through unchanged and the landing is
// still reachable at /landing for review.

export const LANDING_PATH = "/landing"

/** Next's file-convention link-preview images. Their URLs have no extension,
 * so proxy.ts's matcher doesn't skip them. */
const PREVIEW_PATHS = ["/opengraph-image", "/twitter-image"]

export type LandingEnv = Partial<
  Record<"LANDING_HOSTS" | "APP_ORIGIN", string | undefined>
>

export type LandingDecision =
  | { action: "next" }
  | { action: "rewrite"; pathname: string }
  /** Always absolute: the app origin plus the request's path and query. */
  | { action: "redirect"; url: string }

/** "Sponti.fun, www.sponti.fun:443 " → ["sponti.fun", "www.sponti.fun"]. */
export function parseLandingHosts(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((host) => normalizeHost(host))
    .filter((host) => host.length > 0)
}

/** The app's origin ("https://app.sponti.fun"), or null if unset or not an
 * http(s) URL. A bare host gets https. */
export function parseAppOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) return null
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.origin
  } catch {
    return null
  }
}

/** Lowercase, no port, no trailing dot. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

export function routeLandingHost({
  host,
  pathname,
  search,
  env,
}: {
  host: string | null | undefined
  pathname: string
  search: string
  env: LandingEnv
}): LandingDecision {
  const landingHosts = parseLandingHosts(env.LANDING_HOSTS)
  const appOrigin = parseAppOrigin(env.APP_ORIGIN)
  if (landingHosts.length === 0 || !appOrigin) return { action: "next" }

  const requestHost = normalizeHost(host)
  if (!landingHosts.includes(requestHost)) return { action: "next" }
  // A misconfiguration that would loop: the app origin is a landing host.
  if (landingHosts.includes(normalizeHost(new URL(appOrigin).host))) {
    return { action: "next" }
  }

  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname

  if (path === "/" || path === "") {
    return { action: "rewrite", pathname: LANDING_PATH }
  }
  if (
    path === LANDING_PATH ||
    LEGAL_PATHS.includes(path) ||
    PREVIEW_PATHS.includes(path)
  ) {
    return { action: "next" }
  }
  return { action: "redirect", url: `${appOrigin}${pathname}${search}` }
}

/**
 * Where the landing's "open sponti" goes: APP_ORIGIN when it is set, then
 * NEXT_PUBLIC_SITE_URL (the app's public URL), else this origin's "/" (the
 * landing at /landing on the app's own host, for review).
 */
type AppUrlEnv = Partial<
  Record<"APP_ORIGIN" | "NEXT_PUBLIC_SITE_URL", string | undefined>
>

export function landingAppUrl(
  env: AppUrlEnv = {
    APP_ORIGIN: process.env.APP_ORIGIN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  }
): string {
  const origin =
    parseAppOrigin(env.APP_ORIGIN) ?? parseAppOrigin(env.NEXT_PUBLIC_SITE_URL)
  return origin ? `${origin}/` : "/"
}
