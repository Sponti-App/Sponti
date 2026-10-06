import { REDIRECT_PARAM, getSafeRedirectPath } from "@/lib/redirect-path"

// The two ways to add someone (#124), and the URLs that carry them:
//   /qr/<token>     — in-person QR code, 15 min, scanning connects instantly
//   /invite/<token> — invite link for group chats, 7 days, sends a request

export type ContactLinkKind = "qr" | "invite"

const PREFIXES: Record<ContactLinkKind, string> = {
  qr: "/qr/",
  invite: "/invite/",
}

/** Path prefixes a signed-out visitor may open (they land on sign-up). */
export const CONTACT_PATH_PREFIXES = Object.values(PREFIXES)

export function isContactPath(pathname: string): boolean {
  return CONTACT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function contactPath(kind: ContactLinkKind, token: string): string {
  return `${PREFIXES[kind]}${encodeURIComponent(token)}`
}

/**
 * The origin shared links point at. NEXT_PUBLIC_SITE_URL is the SPA's own
 * public URL when it is set (sponti.fun is a separate landing page, so
 * NEXT_PUBLIC_PUBLIC_APP_URL is deliberately not used); otherwise the origin
 * this page is served from, as long as it is a real web origin.
 */
export function contactLinkOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    const withScheme = /^https?:\/\//i.test(configured)
      ? configured
      : `https://${configured}`
    return withScheme.replace(/\/+$/, "")
  }
  if (typeof window === "undefined") return null
  const { protocol, origin } = window.location
  return protocol === "http:" || protocol === "https:" ? origin : null
}

export function buildContactUrl(
  kind: ContactLinkKind,
  token: string
): string | null {
  const origin = contactLinkOrigin()
  return origin ? `${origin}${contactPath(kind, token)}` : null
}

/** `{ kind, token }` if `path` is a QR or invite link path, else null. */
export function parseContactPath(
  path: string | null | undefined
): { kind: ContactLinkKind; token: string } | null {
  if (!path) return null
  const pathname = path.split(/[?#]/)[0] ?? ""
  for (const kind of Object.keys(PREFIXES) as ContactLinkKind[]) {
    const prefix = PREFIXES[kind]
    if (!pathname.startsWith(prefix)) continue
    const raw = pathname.slice(prefix.length)
    if (!raw || raw.includes("/")) return null
    try {
      const token = decodeURIComponent(raw)
      return /^[A-Za-z0-9_-]{1,128}$/.test(token) ? { kind, token } : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * The sign-up page for a signed-out visitor to a contact link, returning to
 * the link afterwards. The sign-in side is `buildLoginPath` (#441).
 */
export function buildRegisterPath(path: string): string {
  const safe = getSafeRedirectPath(path)
  if (safe === "/") return "/register"
  return `/register?${REDIRECT_PARAM}=${encodeURIComponent(safe)}`
}
