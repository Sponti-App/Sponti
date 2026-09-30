import { CONTACT_EMAIL } from "@/lib/contact"

// The support mail (#126): every path goes to CONTACT_EMAIL, with the build
// and device pre-filled under a divider so a bug report arrives with what we'd
// otherwise have to ask for. All of it is read from the browser and sent only
// if the person sends the email themselves.

/** Set at build time (see next.config.mjs). Empty when there's no git info,
 * e.g. a local build. */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? ""
const COMMIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? ""

/** "0.0.1 (a1b2c3d)", "0.0.1" or "unknown" depending on what the build knows. */
export function describeBuild(
  version: string = APP_VERSION,
  commitSha: string = COMMIT_SHA
): string {
  const sha = commitSha.trim().slice(0, 7)
  const ver = version.trim()
  if (ver && sha) return `${ver} (${sha})`
  return ver || sha || "unknown"
}

export type DeviceSource = {
  navigator: Pick<Navigator, "userAgent" | "platform" | "language">
  screen: Pick<Screen, "width" | "height">
  pixelRatio: number
}

function browserSource(): DeviceSource | null {
  if (typeof window === "undefined") return null
  return {
    navigator: window.navigator,
    screen: window.screen,
    pixelRatio: window.devicePixelRatio,
  }
}

/** A few plain lines describing this browser; "" when there's no window. */
export function describeDevice(
  source: DeviceSource | null = browserSource()
): string {
  if (!source) return ""
  const { navigator: nav, screen, pixelRatio } = source
  return [
    `platform: ${nav.platform || "unknown"}`,
    `browser: ${nav.userAgent}`,
    `language: ${nav.language}`,
    `screen: ${screen.width}x${screen.height} @${pixelRatio || 1}x`,
  ].join("\n")
}

/** The body: room for the person's own words first, then the tech details. */
export function buildSupportBody(device: string, build: string): string {
  const details = [`sponti build: ${build}`, device].filter(Boolean).join("\n")
  return `\n\n\n---\nplease keep the lines below, they help us find the problem.\n${details}`
}

export function supportMailto(
  subject: string,
  device: string,
  build: string = describeBuild()
): string {
  return (
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(buildSupportBody(device, build))}`
  )
}
