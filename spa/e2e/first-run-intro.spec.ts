import { expect, test, type Page } from "@playwright/test"
import { BERLIN_COORDS, stubBackend } from "./support/stubs"

// #313: a new account gets a three-screen intro once, over the first map,
// ending in "add your first friend" (no friends yet) or "light your first
// flare" (already connected). Signing in on an existing account never shows
// it. Everything runs against stubbed backends.

// A day when the berlin idea spots near humboldthain are in season.
const JUNE = "2026-06-15T12:00:00.000Z"

const intro = (page: Page) =>
  page.getByRole("dialog", { name: "welcome to sponti" })
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })

// A signed-out stub: the register and login forms get a session back. `friends`
// picks the intro's final call to action.
function stubSignedOut(page: Page, options: { friends: number }) {
  return stubBackend(page, {
    signedOut: true,
    friends: options.friends,
    coords: BERLIN_COORDS,
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
  ).toBeVisible()
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
  test("register → intro → add your first friend → map, and only once", async ({
    page,
  }) => {
    await stubSignedOut(page, { friends: 0 })
    await register(page)

    await expect(intro(page)).toBeVisible()
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
    await expect(nav(page)).toBeVisible()
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

    await expect(intro(page)).toBeVisible()
    await intro(page).getByRole("button", { name: "skip", exact: true }).click()

    await expect(intro(page)).toHaveCount(0)
    await expect(nav(page)).toBeVisible()
    await page.reload()
    await expect(nav(page)).toBeVisible()
    await expect(intro(page)).toHaveCount(0)
  })

  test("signing in on an existing account never shows it", async ({ page }) => {
    await stubSignedOut(page, { friends: 0 })
    await page.goto("/login")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /sign in/i }).click()

    await expect(nav(page)).toBeVisible()
    await expect(intro(page)).toHaveCount(0)
  })
})
