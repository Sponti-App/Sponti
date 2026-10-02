import { expect, test, type Page, type Route } from "@playwright/test"
import { API_BASE, AUTH_BASE, BERLIN_COORDS, STUB_USER } from "./support/stubs"

// #313: a new account gets a three-screen intro once, over the first map,
// ending in "add your first friend" (no friends yet) or "light your first
// flare" (already connected). Signing in on an existing account never shows
// it. Everything runs against stubbed backends.

const FIRST_COMPILE = { timeout: 30_000 }
// A day when the berlin idea spots near humboldthain are in season.
const JUNE = "2026-06-15T12:00:00.000Z"

const intro = (page: Page) =>
  page.getByRole("dialog", { name: "welcome to sponti" })
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

async function stubSignedOut(page: Page, options: { friends: number }) {
  await page.addInitScript((coords) => {
    window.localStorage.setItem(
      "sponti.geo.last-known-coords.v1",
      JSON.stringify(coords)
    )
  }, BERLIN_COORDS)

  const session = {
    accessToken: "e2e-access-token",
    refreshToken: "e2e-refresh-token",
    user: STUB_USER,
  }
  await page.route(`${AUTH_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/auth/register" || path === "/auth/login") {
      await json(route, session)
      return
    }
    if (path === "/auth/me") {
      await json(route, { user: STUB_USER })
      return
    }
    await json(route, { status: "ok" })
  })

  const connections = Array.from({ length: options.friends }, (_, i) => ({
    _id: `conn-${i}`,
    requesterId: STUB_USER.id,
    receiverId: `friend-${i}`,
    status: "accepted",
    otherUser: { _id: `friend-${i}`, username: `friend${i}` },
  }))
  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api\/v1/,
      ""
    )
    if (path === "/connections") {
      await json(route, {
        data: connections,
        pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
      })
      return
    }
    if (path === "/notifications/unread-count") {
      await json(route, { data: { count: 0 } })
      return
    }
    if (path === "/notifications") {
      await json(route, { data: [], pagination: { nextCursor: null } })
      return
    }
    if (path === "/events/mine/upcoming") {
      await json(route, { data: { hostedByMe: [], invited: [] } })
      return
    }
    if (path === "/events/calendar/upcoming") {
      await json(route, {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      return
    }
    await json(route, { data: [] })
  })
}

async function register(page: Page) {
  await page.goto("/register")
  await page.getByLabel("your name").fill("Sam")
  await page.getByLabel("username").fill("sam")
  await page.getByLabel("email").fill("sam@example.com")
  await page.getByLabel("password").fill("password123")
  await page.getByRole("button", { name: /create account/i }).click()
}

async function walkToLastScreen(page: Page) {
  await expect(
    page.getByRole("heading", { name: "see flares near you" })
  ).toBeVisible(FIRST_COMPILE)
  await intro(page).getByRole("button", { name: "next", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "light a flare fast" })
  ).toBeVisible()
  await intro(page).getByRole("button", { name: "next", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "choose who sees it" })
  ).toBeVisible()
}

test.describe("first-run intro (#313)", () => {
  // Register, the map and the composer each compile on first visit.
  test.describe.configure({ timeout: 60_000 })

  test("register → intro → add your first friend → map, and only once", async ({
    page,
  }) => {
    await stubSignedOut(page, { friends: 0 })
    await register(page)

    await expect(intro(page)).toBeVisible(FIRST_COMPILE)
    await walkToLastScreen(page)
    await intro(page)
      .getByRole("button", { name: "add your first friend" })
      .click()

    await expect(intro(page)).toHaveCount(0)
    await expect(page.getByText("your qr")).toBeVisible()
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByText("your qr")).toHaveCount(0)
    await expect(nav(page)).toBeVisible()

    await page.reload()
    await expect(nav(page)).toBeVisible(FIRST_COMPILE)
    await expect(intro(page)).toHaveCount(0)
  })

  test("already connected: light your first flare opens the composer with an idea", async ({
    page,
  }) => {
    await page.clock.setFixedTime(JUNE)
    await stubSignedOut(page, { friends: 1 })
    await register(page)

    await walkToLastScreen(page)
    await intro(page)
      .getByRole("button", { name: "light your first flare" })
      .click()

    await expect(intro(page)).toHaveCount(0)
    await expect(
      page.getByPlaceholder("what's the plan? e.g. drinks after work")
    ).not.toHaveValue("")
  })

  test("skip works from the first screen and lands on the map", async ({
    page,
  }) => {
    await stubSignedOut(page, { friends: 0 })
    await register(page)

    await expect(intro(page)).toBeVisible(FIRST_COMPILE)
    await intro(page).getByRole("button", { name: "skip", exact: true }).click()

    await expect(intro(page)).toHaveCount(0)
    await expect(nav(page)).toBeVisible()
    await page.reload()
    await expect(nav(page)).toBeVisible(FIRST_COMPILE)
    await expect(intro(page)).toHaveCount(0)
  })

  test("signing in on an existing account never shows it", async ({ page }) => {
    await stubSignedOut(page, { friends: 0 })
    await page.goto("/login", FIRST_COMPILE)
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /sign in/i }).click()

    await expect(nav(page)).toBeVisible(FIRST_COMPILE)
    await expect(intro(page)).toHaveCount(0)
  })
})
