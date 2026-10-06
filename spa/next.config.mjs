import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const appDir = dirname(fileURLToPath(import.meta.url))

// Next.js matches the request's Origin *hostname* against this list, so entries
// must be DNS-shaped (e.g. "192.168.1.10"), not full URLs with scheme/port.
function getAllowedDevOrigins() {
  const hostnames = new Set(["127.0.0.1"])
  const devServerUrl = process.env.NEXT_PUBLIC_DEV_SERVER_URL

  if (devServerUrl) {
    try {
      hostnames.add(new URL(devServerUrl).hostname)
    } catch {
      // Ignore malformed URLs and keep the local fallbacks.
    }
  }

  return [...hostnames]
}

function getAppVersion() {
  try {
    return JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"))
      .version
  } catch {
    return ""
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build info for the support email (#126, spa/lib/support-mail.ts). Vercel
  // exposes the commit as VERCEL_GIT_COMMIT_SHA while building; mapping it
  // here means nothing has to be added in the Vercel project settings.
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      "",
  },
  images: {
    unoptimized: true, // required for static export
  },
  allowedDevOrigins: getAllowedDevOrigins(),
  // Next's dev-tools badge sits over the bottom nav's home tab and blocks
  // Playwright clicks on it (#434). The e2e web server sets this (see
  // playwright.config.ts); a normal `npm run dev` keeps the badge.
  ...(process.env.E2E_HIDE_DEV_INDICATOR === "1"
    ? { devIndicators: false }
    : {}),
  // The e2e suite runs a second dev server built with the full feature
  // profile (playwright.config.ts). Next locks its build folder per server,
  // so that one builds into its own folder under .next.
  ...(process.env.E2E_DIST_DIR ? { distDir: process.env.E2E_DIST_DIR } : {}),
  turbopack: {
    root: appDir,
  },
}

export default nextConfig
