import { defineConfig, devices } from "@playwright/test"

const isCI = !!process.env.CI

// Browser-level smoke tests against a network-stubbed app — no real backend,
// no shared database. See README.md's Testing section and issue #109.
//
// Deliberately fixed, unusual port: distinct from the dev server (3000),
// api (4000) and auth-server (3001/3002) so this never collides with a
// service a developer already has running locally.
const PORT = process.env.PLAYWRIGHT_WEB_SERVER_PORT ?? "4415"
const BASE_URL = `http://127.0.0.1:${PORT}`

// A second server, built with the full feature profile, for the specs in
// e2e/full-profile/: surfaces that are flagged off in the tester build (#389's
// signed-out map first). Flags are inlined at build time, so a flag can't be
// flipped per test. Every other spec runs against the tester build above.
const FULL_PORT =
  process.env.PLAYWRIGHT_FULL_WEB_SERVER_PORT ?? String(Number(PORT) + 1000)
const FULL_BASE_URL = `http://127.0.0.1:${FULL_PORT}`
const FULL_PROFILE_DIR = /full-profile\//

// Fake, unresolvable hosts. Nothing here is ever meant to receive a real
// network request — every call to either base is intercepted by page.route in
// the tests (see e2e/support/stubs.ts). If a test hits the real network,
// that's a bug in the stub, not a live dependency.
const SERVER_ENV = {
  // Hide Next's dev-tools badge: it covers the bottom nav's home tab and
  // blocks taps on it (#434). Read by next.config.mjs.
  E2E_HIDE_DEV_INDICATOR: "1",
  NEXT_PUBLIC_AUTH_BASE_URL: "http://stub-auth.sponti.test",
  NEXT_PUBLIC_API_BASE_URL: "http://stub-api.sponti.test",
  // No Google Maps key: MapView renders its non-interactive
  // StaticMapFallback instead of loading the Google Maps JS SDK.
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
  NEXT_PUBLIC_GOOGLE_MAPS_ID: "",
  NEXT_PUBLIC_SEED_DEMO_DATA: "",
  // #467: host routing for the landing page (proxy.ts). Only a request whose
  // Host is sponti.test is routed; the tests' own 127.0.0.1 is untouched.
  // APP_ORIGIN is also where the landing's "open sponti" goes.
  LANDING_HOSTS: "sponti.test",
  APP_ORIGIN: "http://app.sponti.test",
}

const MOBILE = {
  ...devices["Desktop Chrome"],
  browserName: "chromium" as const,
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  // Local: reuse the machine's real Chrome so no browser download is
  // required. CI installs its own chromium (see the workflow / README)
  // and doesn't set this, so it falls back to Playwright's bundled build.
  ...(isCI ? {} : { channel: "chrome" }),
}

// #467: the mobile gate shows a notice on a desktop-sized screen without touch,
// which is this config's "desktop" project. Seeding "continue anyway" (spa/lib/
// mobile-gate.ts) lets every existing desktop spec reach the app; the gate's
// own spec clears it with `test.use({ storageState: ... })`.
const DESKTOP_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: BASE_URL,
      localStorage: [{ name: "sponti.mobile-gate.v1", value: "continue" }],
    },
  ],
}

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
      testIgnore: FULL_PROFILE_DIR,
      use: MOBILE,
    },
    {
      name: "desktop",
      testIgnore: FULL_PROFILE_DIR,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        storageState: DESKTOP_STORAGE_STATE,
        ...(isCI ? {} : { channel: "chrome" }),
      },
    },
    {
      name: "mobile-full-profile",
      testMatch: FULL_PROFILE_DIR,
      use: { ...MOBILE, baseURL: FULL_BASE_URL },
      // Only what these specs visit, warmed by global-setup.ts.
      metadata: { warmRoutes: ["/", "/register", "/login"] },
    },
  ],
  webServer: [
    {
      // Turbopack (the default `next dev`) rejects a symlinked node_modules,
      // which a worktree checkout of this repo often has — webpack doesn't
      // care, and is fine for a smoke test either way.
      command: `npx next dev --webpack --hostname 127.0.0.1 --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: SERVER_ENV,
    },
    {
      command: `npx next dev --webpack --hostname 127.0.0.1 --port ${FULL_PORT}`,
      url: FULL_BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        ...SERVER_ENV,
        NEXT_PUBLIC_FEATURE_PROFILE: "full",
        // Next locks its build folder, so this server needs its own.
        E2E_DIST_DIR: ".next/e2e-full",
      },
    },
  ],
})
