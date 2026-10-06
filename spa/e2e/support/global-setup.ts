import type { FullConfig } from "@playwright/test"

// Next dev (webpack) compiles each route lazily on its first request, then
// serves it from cache. Playwright's webServer starts before this file runs
// and before any test worker does, so a single serial warm-up request per
// route here pays that one-time compile cost up front — instead of letting
// several parallel workers' first navigations race to compile the same
// route at once, which can blow past a test's 30s timeout under CPU
// contention (the intermittent beforeEach timeouts this was added to fix).
//
// Dynamic routes compile once per route, not per param, so any id works. They
// matter for tests that tap a link and expect the URL to change: a client-side
// navigation to a cold route doesn't update the URL until the dev server has
// compiled it, which can outlast the 10s expect timeout under load (#307).
//
// The list covers every page the specs visit or navigate to (#323), not just
// the two dynamic ones: a cold route compiled by two workers at once was the
// cause of the first-attempt failures in legal-pages, menu-back, idea-pins and
// first-friend. Keep it in step with the routes in e2e/*.spec.ts.
const ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/circles",
  "/settings",
  "/settings/profile",
  "/menu",
  "/menu/about-sponti",
  "/menu/faq-feedback",
  "/menu/impressum",
  "/menu/privacy",
  "/menu/support",
  "/menu/terms",
  "/event",
  "/event/new",
  "/event/warm-up",
  "/event/warm-up/edit",
  "/invite/warm-up",
  "/profile/warm-up",
  "/qr/warm-up",
  "/landing",
]

// Next dev also *disposes* a compiled route that nobody has requested for
// 60 s (onDemandEntries.maxInactiveAge), so a warm-up done once at the start is
// gone by the time a late spec reaches a rarely-visited route (/event,
// /settings, /menu/*): its first visit compiles again, and a tap that should
// change the URL does not within the expect timeout. The suite takes minutes,
// so the routes are touched again well inside that window until teardown.
const KEEP_WARM_MS = 20_000

async function warm(baseURL: string, routes: readonly string[]) {
  for (const route of routes) {
    try {
      const res = await fetch(new URL(route, baseURL))
      // Draining the body ensures Next has actually finished rendering the
      // route (not just started compiling it) before we return.
      await res.text()
    } catch {
      // Best-effort warm-up only. If this fails, tests still work — they'll
      // just pay the compile cost themselves, same as before this file
      // existed.
    }
  }
}

/** Each server once: the routes its first project lists in
 * `metadata.warmRoutes` (the full-profile server, #389), or all of ROUTES. */
function serversToWarm(config: FullConfig): Map<string, readonly string[]> {
  const servers = new Map<string, readonly string[]>()
  for (const project of config.projects) {
    const baseURL = project.use?.baseURL
    if (!baseURL || servers.has(baseURL)) continue
    const listed = (project.metadata as { warmRoutes?: unknown } | undefined)
      ?.warmRoutes
    servers.set(
      baseURL,
      Array.isArray(listed)
        ? listed.filter((r) => typeof r === "string")
        : ROUTES
    )
  }
  return servers
}

async function warmAll(servers: Map<string, readonly string[]>) {
  await Promise.all(
    [...servers].map(([baseURL, routes]) => warm(baseURL, routes))
  )
}

export default async function globalSetup(config: FullConfig) {
  const servers = serversToWarm(config)
  if (servers.size === 0) return

  await warmAll(servers)

  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await warmAll(servers)
    } finally {
      running = false
    }
  }, KEEP_WARM_MS)

  return () => clearInterval(timer)
}
