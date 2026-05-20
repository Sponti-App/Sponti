import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const appDir = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // required for static export
  },
  allowedDevOrigins: ["192.168.178.185"],
  turbopack: {
    root: appDir,
  },
}

export default nextConfig
