import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #294: the faq page used to show a fake feedback form that sent nothing.
// Feedback now goes through support.

test.describe("faq & feedback (#294)", () => {
  test("has no form and sends feedback to support", async ({ page }) => {
    await stubBackend(page)
    await page.goto("/menu/faq-feedback")

    await expect(
      page.getByRole("heading", { name: "faq & feedback" })
    ).toBeVisible()
    await expect(page.locator("form, textarea, input")).toHaveCount(0)
    await expect(page.getByText("example.com")).toHaveCount(0)
    await expect(page.getByText(/prototype|in production/)).toHaveCount(0)

    await page.getByRole("link", { name: "send feedback or get help" }).click()

    await expect(page).toHaveURL(/\/menu\/support$/)
  })
})
