import { dirname } from "node:path"
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // required for static export
  },
  allowedDevOrigins: getAllowedDevOrigins(),
  turbopack: {
    root: appDir,
  },
}

export default nextConfig
