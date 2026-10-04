import { defineConfig, devices } from "@playwright/test"

// Browser-level smoke tests against a network-stubbed app — no real backend,
// no shared database. See README.md's Testing section and issue #109.
//
// Deliberately fixed, unusual port: distinct from the dev server (3000),
// api (4000) and auth-server (3001/3002) so this never collides with a
// service a developer already has running locally.
const PORT = process.env.PLAYWRIGHT_WEB_SERVER_PORT ?? "4415"
const BASE_URL = `http://127.0.0.1:${PORT}`

const isCI = !!process.env.CI

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  // No retries locally: a retry hides a flaky spec, and global-setup warms
  // every route so a first visit doesn't race a compile (#323, #344). CI keeps
  // one: 4 of the 7 CI runs checked on 2 Oct needed it, always for
  // notifications-sheet's "keeps the toast anchor above the open sheet" spec.
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        // Local: reuse the machine's real Chrome so no browser download is
        // required. CI installs its own chromium (see the workflow / README)
        // and doesn't set this, so it falls back to Playwright's bundled build.
        ...(isCI ? {} : { channel: "chrome" }),
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        ...(isCI ? {} : { channel: "chrome" }),
      },
    },
  ],
  webServer: {
    // Turbopack (the default `next dev`) rejects a symlinked node_modules,
    // which a worktree checkout of this repo often has — webpack doesn't
    // care, and is fine for a smoke test either way.
    command: `npx next dev --webpack --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      // Hide Next's dev-tools badge: it covers the bottom nav's home tab and
      // blocks taps on it (#434). Read by next.config.mjs.
      E2E_HIDE_DEV_INDICATOR: "1",
      // Fake, unresolvable hosts. Nothing here is ever meant to receive a
      // real network request — every call to either base is intercepted by
      // page.route in the tests (see e2e/support/stubs.ts). If a test hits
      // the real network, that's a bug in the stub, not a live dependency.
      NEXT_PUBLIC_AUTH_BASE_URL: "http://stub-auth.sponti.test",
      NEXT_PUBLIC_API_BASE_URL: "http://stub-api.sponti.test",
      // No Google Maps key: MapView renders its non-interactive
      // StaticMapFallback instead of loading the Google Maps JS SDK.
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      NEXT_PUBLIC_GOOGLE_MAPS_ID: "",
      NEXT_PUBLIC_SEED_DEMO_DATA: "",
    },
  },
})
