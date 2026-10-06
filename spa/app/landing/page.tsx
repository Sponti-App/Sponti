import type { Metadata } from "next"
import { LandingPage } from "@/components/landing-page"
import { landingAppUrl } from "@/lib/landing-host"

// #467 part 1: the landing page. On the landing host (LANDING_HOSTS) proxy.ts
// rewrites "/" here; anywhere else it is reachable at /landing for review.
// Statically rendered at build time: APP_ORIGIN (or NEXT_PUBLIC_SITE_URL) is
// read then, so changing it needs a redeploy. The link-preview image is the
// app's own (app/opengraph-image.tsx, app/twitter-image.tsx).
export const dynamic = "force-static"

const title = "sponti"
const description =
  "plans with friends, right now or soon. light a flare and let your friends join."

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, siteName: title, type: "website" },
  twitter: { card: "summary_large_image", title, description },
}

export default function Landing() {
  return <LandingPage appUrl={landingAppUrl()} />
}
