// Resolves the public base URL used for absolute metadata (Open Graph /
// Twitter card URLs, `metadataBase`). sponti.fun currently serves a separate
// landing page and the Vercel production alias isn't settled yet (#127), so
// this reads an explicit override first and falls back to what Vercel sets
// automatically, then to localhost for local dev.
//
// Precedence:
//   1. NEXT_PUBLIC_SITE_URL      — explicit override; set this on Vercel once
//      the public domain for the SPA is decided.
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's stable production domain,
//      set automatically on Vercel (no scheme, so one is added).
//   3. VERCEL_URL                — Vercel's per-deployment domain (previews),
//      set automatically on Vercel (no scheme, so one is added).
//   4. http://localhost:3000     — local dev fallback.
type SiteUrlEnv = Partial<
  Record<
    "NEXT_PUBLIC_SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "VERCEL_URL",
    string | undefined
  >
>

export function resolveSiteUrl(env: SiteUrlEnv = process.env as SiteUrlEnv): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return withScheme(stripTrailingSlash(explicit))

  const productionUrl = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (productionUrl) return withScheme(stripTrailingSlash(productionUrl))

  const deploymentUrl = env.VERCEL_URL?.trim()
  if (deploymentUrl) return withScheme(stripTrailingSlash(deploymentUrl))

  return "http://localhost:3000"
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}
