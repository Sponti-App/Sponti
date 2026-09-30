import { expect, test } from "@playwright/test"
import { API_BASE, AUTH_BASE, stubBackend } from "./support/stubs"

// #295: the back arrow on the menu pages returns to where the visitor came
// from, and falls back sensibly when the page was opened directly.

const TERMS_LINK = 'a[href="/menu/terms"]'

test.describe("menu pages back arrow (#295)", () => {
  test.beforeEach(async ({ page }) => {
    // Signed-out specs never reach a backend, but the register page pings
    // one on load. Answer instead of leaving it to fail on a fake host.
    for (const base of [AUTH_BASE, API_BASE]) {
      await page.route(`${base}/**`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        })
      )
    }
  })

  test("signed out: register -> terms -> back lands on register", async ({
    page,
  }) => {
    await page.goto("/register")
    await page.locator(TERMS_LINK).click()
    await expect(page).toHaveURL(/\/menu\/terms$/)

    await page.getByRole("link", { name: "back" }).click()

    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByLabel(/name/i).first()).toBeVisible()
  })

  test("signed out: register -> privacy -> back lands on register", async ({
    page,
  }) => {
    await page.goto("/register")
    await page.locator('a[href="/menu/privacy"]').click()
    await expect(page).toHaveURL(/\/menu\/privacy$/)

    await page.getByRole("link", { name: "back" }).click()

    await expect(page).toHaveURL(/\/register$/)
  })

  test("signed out: a terms page opened directly falls back to register", async ({
    page,
  }) => {
    await page.goto("/menu/terms")

    await page.getByRole("link", { name: "back" }).click()

    await expect(page).toHaveURL(/\/register$/)
  })

  test("signed in: menu -> terms -> back lands on the menu", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/menu")
    await page.locator(TERMS_LINK).first().click()
    await expect(page).toHaveURL(/\/menu\/terms$/)

    await page.getByRole("link", { name: "back" }).click()

    await expect(page).toHaveURL(/\/menu$/)
  })

  test("signed in: a menu page opened directly falls back to the menu", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/menu/privacy")

    await page.getByRole("link", { name: "back" }).click()

    await expect(page).toHaveURL(/\/menu$/)
  })

  test("signed in: back returns to the page the visitor came from, not always the menu", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/menu/faq-feedback")
    await page.locator('a[href="/menu/terms"]').first().click()
    await expect(page).toHaveURL(/\/menu\/terms$/)

    await page.getByRole("link", { name: "back" }).click()

    await expect(page).toHaveURL(/\/menu\/faq-feedback$/)
  })
})
