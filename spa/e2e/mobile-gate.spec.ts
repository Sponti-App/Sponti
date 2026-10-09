import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #467 part 2: on a desktop-sized screen without touch, sponti says it is made
// for a phone and offers a QR code to open it there. "continue anyway" is
// remembered per device. The legal pages are never gated, and a phone never
// sees the notice. The desktop project's config seeds "continue anyway" so the
// other specs reach the app; these start from a device that has not chosen.

const GATE_KEY = "sponti.mobile-gate.v1"

test.use({ storageState: { cookies: [], origins: [] } })

const notice = (page: import("@playwright/test").Page) =>
  page.locator("[data-mobile-gate='notice']")

test.describe("mobile gate (#467)", () => {
  test("desktop: shows the notice with a QR code and the legal links, not the app", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop notice")
    await stubBackend(page, { signedOut: true })
    await page.goto("/login")

    await expect(
      notice(page).getByRole("heading", {
        name: "sponti is made for your phone",
      })
    ).toBeVisible()
    await expect(
      notice(page).getByText("scan this to open it there.")
    ).toBeVisible()
    await expect(
      notice(page).getByRole("img", { name: "qr code of this page" })
    ).toHaveAttribute("src", /^data:image\/png;base64,/)
    await expect(
      notice(page).getByRole("button", { name: "continue anyway" })
    ).toBeVisible()
    await expect(
      notice(page).getByRole("navigation", { name: "legal" })
    ).toBeVisible()
    // The app itself is not rendered behind it.
    await expect(
      page.getByRole("button", { name: /sign in|log in/i })
    ).toHaveCount(0)
  })

  test("desktop: 'continue anyway' opens the app and is remembered", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop notice")
    await stubBackend(page, { signedOut: true })
    await page.goto("/login")

    await notice(page).getByRole("button", { name: "continue anyway" }).click()
    await expect(notice(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/login$/)
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), GATE_KEY)
    ).toBe("continue")

    await page.reload()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.locator("form")).toBeVisible()
    await expect(notice(page)).toHaveCount(0)
  })

  test("desktop: the legal pages are never gated", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop notice")
    await stubBackend(page, { signedOut: true })

    for (const path of [
      "/menu/impressum",
      "/menu/privacy",
      "/menu/terms",
      "/menu/about-sponti",
    ]) {
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(notice(page)).toHaveCount(0)
    }
  })

  test("desktop: the notice's legal links open the legal pages", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop notice")
    await stubBackend(page, { signedOut: true })
    await page.goto("/login")

    await notice(page).getByRole("link", { name: "privacy" }).click()
    await expect(page).toHaveURL(/\/menu\/privacy$/)
    await expect(notice(page)).toHaveCount(0)
  })

  test("phone: never sees the notice", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone project")
    await stubBackend(page, { signedOut: true })
    await page.goto("/login")

    await expect(page.locator("form")).toBeVisible()
    await expect(notice(page)).toHaveCount(0)
    await expect(page.getByText("sponti is made for your phone")).toHaveCount(0)
  })
})
