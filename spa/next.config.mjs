/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // required for static export
  },
  allowedDevOrigins: ['192.168.178.185'],
}

export default nextConfig
