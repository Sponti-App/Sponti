import type { Metadata } from "next"
import { LandingPage } from "@/components/landing-page"
import { landingAppUrl } from "@/lib/landing-host"
import { landingDisplay } from "./fonts"

// #467 part 1, rebuilt in #506: the landing page. On the landing host (LANDING_HOSTS) proxy.ts
// rewrites "/" here; anywhere else it is reachable at /landing for review.
// Statically rendered at build time: APP_ORIGIN (or NEXT_PUBLIC_SITE_URL) is
// read then, so changing it needs a redeploy. The link-preview image is the
// app's own (app/opengraph-image.tsx, app/twitter-image.tsx).
export const dynamic = "force-static"

// Search and share cards read the title cold: it says what sponti is. The
// description says how it works.
const title = "sponti: plans with friends, right now or soon"
const description =
  "host a gathering with your friends, or join one. the map shows what's happening now, the calendar what's coming up."

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, siteName: title, type: "website" },
  twitter: { card: "summary_large_image", title, description },
}

export default function Landing() {
  return (
    <div className={landingDisplay.variable}>
      <LandingPage appUrl={landingAppUrl()} />
    </div>
  )
}
