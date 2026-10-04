import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #434: Next's dev-tools badge used to sit over the bottom nav's home tab in
// `next dev`, so no spec could tap it. The e2e web server now turns the badge
// off (E2E_HIDE_DEV_INDICATOR, see playwright.config.ts). Playwright's click
// waits for the target to receive the event, so this fails if anything covers
// the tab again.

test.describe("bottom nav home tab (#434)", () => {
  test("a real tap on home returns to the map, and the dev badge is off", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/circles")

    const nav = page.getByRole("navigation", { name: "Primary" })
    await expect(nav).toBeVisible()
    await expect(page.locator("[data-nextjs-dev-tools-button]")).toHaveCount(0)

    await nav.getByRole("button", { name: "Home" }).click()

    await expect(page).toHaveURL(/\/$/)
  })
})
