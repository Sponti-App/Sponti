import { NextResponse, type NextRequest } from "next/server"
import { routeLandingHost } from "@/lib/landing-host"

// #467 part 1: host routing for the landing page. The rules and the no-env
// pass-through live in lib/landing-host.ts. Next 16 names this file proxy.ts
// (formerly middleware.ts) and runs it on the Node.js runtime, so the env is
// read per request.
export function proxy(request: NextRequest) {
  const decision = routeLandingHost({
    host: request.headers.get("host") ?? request.nextUrl.host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    env: {
      LANDING_HOSTS: process.env.LANDING_HOSTS,
      APP_ORIGIN: process.env.APP_ORIGIN,
    },
  })

  switch (decision.action) {
    case "rewrite": {
      const url = request.nextUrl.clone()
      url.pathname = decision.pathname
      return NextResponse.rewrite(url)
    }
    case "redirect":
      // 307, not 308: browsers cache a permanent redirect, and the domain
      // setup may still change.
      return NextResponse.redirect(decision.url, 307)
    default:
      return NextResponse.next()
  }
}

export const config = {
  matcher: [
    // Everything except Next's own files (/_next), the api routes (/api) and
    // static files by extension (public/, favicon, manifest). Dots elsewhere
    // in a path (a username, say) still go through.
    "/((?!_next/|api/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|webmanifest|txt|xml|json|js|css|map|woff2?)$).*)",
  ],
}
