import type { FullConfig } from "@playwright/test"

// Next dev (webpack) compiles each route lazily on its first request, then
// serves it from cache. Playwright's webServer starts before this file runs
// and before any test worker does, so a single serial warm-up request per
// route here pays that one-time compile cost up front — instead of letting
// several parallel workers' first navigations race to compile the same
// route at once, which can blow past a test's 30s timeout under CPU
// contention (see playwright.config.ts's `retries` comment, and the
// intermittent beforeEach timeouts this was added to fix).
const ROUTES = ["/", "/event"]

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) return

  for (const route of ROUTES) {
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
