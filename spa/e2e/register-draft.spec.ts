import { expect, test } from "@playwright/test"
import { API_BASE, AUTH_BASE } from "./support/stubs"

// #300: what was typed into the register form survives a trip to the terms,
// the privacy note or the impressum, except the password.

test.describe("register form draft (#300)", () => {
  test.beforeEach(async ({ page }) => {
    // Signed out, but the register page pings both backends on load.
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

  for (const { link, path } of [
    { link: "terms", path: "/menu/terms" },
    { link: "privacy note", path: "/menu/privacy" },
    { link: "impressum", path: "/menu/impressum" },
  ]) {
    test(`keeps name, username and email after the ${link} and back`, async ({
      page,
    }) => {
      await page.goto("/register")
      await page.getByLabel("your name").fill("Sam")
      await page.getByLabel("username").fill("sam")
      await page.getByLabel("email").fill("sam@example.com")
      await page.getByLabel("password").fill("password123")

      await page.getByRole("link", { name: link, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await page.goBack()
      await expect(page).toHaveURL(/\/register$/)

      await expect(page.getByLabel("your name")).toHaveValue("Sam")
      await expect(page.getByLabel("username")).toHaveValue("sam")
      await expect(page.getByLabel("email")).toHaveValue("sam@example.com")
      await expect(page.getByLabel("password")).toHaveValue("")

      const stored = await page.evaluate(() =>
        Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k))
      )
      expect(stored.join(" ")).not.toContain("password123")
    })
  }

  test("the in-page back arrow restores it too", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("your name").fill("Sam")
    await page.getByRole("link", { name: "terms", exact: true }).click()
    await expect(page).toHaveURL(/\/menu\/terms$/)

    await page.getByRole("link", { name: "back" }).click()

    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByLabel("your name")).toHaveValue("Sam")
  })
})
