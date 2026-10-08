import { expect, test, type Page } from "@playwright/test"
import { ANYWHERE_IDEAS } from "../../lib/flare-ideas.anywhere.data"
import { stubBackend } from "../support/stubs"

// #515 on the signed-out map (`browseBeforeSignup`, the full profile): floating
// ideas around the map's start, a tap opens the same idea card, "light a flare"
// asks to sign up with the place-less draft kept, and signing up lands back in
// the composer with the idea and no place. The pick is seeded by the day and
// the 3-hour slot on the device clock, so the clock and timezone are fixed.
test.use({ timezoneId: "Europe/Berlin" })
const EVENING = "2026-06-15T17:00:00.000Z"

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const sheet = (page: Page) => page.locator('[data-sheet="sign up"]')
const welcome = (page: Page) => page.locator('[data-sheet="welcome in"]')
const floating = (page: Page) => page.locator("[data-floating-idea]")
const composerTitle = (page: Page) =>
  page.getByPlaceholder("what's the plan? e.g. drinks after work")

async function openSignedOutMap(
  page: Page,
  options: { friends?: number } = {}
) {
  await page.clock.setFixedTime(EVENING)
  await stubBackend(page, { signedOut: true, friends: options.friends })
  await page.goto("/")
  await expect(nav(page)).toBeVisible()
}

async function firstTitle(page: Page) {
  const label = await floating(page).first().getAttribute("aria-label")
  return (label ?? "").replace(/^idea: /, "")
}

test.describe("floating ideas, signed out (#515)", () => {
  test("a visitor sees place-less ideas on the map and taps one", async ({
    page,
  }) => {
    await openSignedOutMap(page)
    await expect(floating(page)).toHaveCount(3)

    const title = await firstTitle(page)
    expect(ANYWHERE_IDEAS.some((i) => i.title === title)).toBe(true)
    await page.getByRole("button", { name: `idea: ${title}` }).click()
    const card = page.locator("[data-quiet-card]")
    await expect(card).toHaveAttribute("data-quiet-card", "idea")
    await expect(card.getByText(title, { exact: true })).toBeVisible()
    await expect(
      card.getByText(/at your place or wherever you are/)
    ).toBeVisible()
    await expect(card.getByText(/\d\s?(km|m)\b/)).toHaveCount(0)
  })

  test("light a flare asks to sign up with the idea kept, and signing up lands in the composer with it and no place", async ({
    page,
  }) => {
    await openSignedOutMap(page, { friends: 1 })
    const title = await firstTitle(page)
    const idea = ANYWHERE_IDEAS.find((i) => i.title === title)!

    await page.getByRole("button", { name: `idea: ${title}` }).click()
    await page
      .locator("[data-quiet-card]")
      .getByRole("button", { name: "light a flare" })
      .click()

    await expect(sheet(page).getByText("sign up to light it")).toBeVisible()
    const kept = sheet(page).locator(`[data-kept-draft="${idea.id}"]`)
    await expect(kept).toContainText(title)
    await expect(kept).toContainText("wherever you are")
    await expect(kept).toContainText("kept for after sign-up")

    await sheet(page).getByRole("link", { name: "create an account" }).click()
    await expect(page).toHaveURL(/\/register\?redirectTo=%2F%3Fresume%3Dflare$/)
    await page.getByLabel("your name").fill("Sam")
    await page.getByLabel("username").fill("sam")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /create account/i }).click()

    await expect(welcome(page)).toContainText(title)
    await welcome(page)
      .getByRole("button", { name: "let's light it up" })
      .click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue(title)
    await expect(page.getByText(`type · ${idea.category}`)).toBeVisible()
    await expect(page.getByText("my location").first()).toBeVisible()
  })
})
