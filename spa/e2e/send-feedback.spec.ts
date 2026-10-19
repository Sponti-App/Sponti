import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// In-app feedback: one tap from the menu (it used to be menu → faq & feedback
// → support → a Mail draft). The message goes to POST /auth/feedback with the
// screen it was sent from.

test.describe("send feedback", () => {
  test("the menu opens the sheet, and a bug report is sent with its screen", async ({
    page,
  }) => {
    const backend = await stubBackend(page)
    await page.goto("/")
    await page.getByRole("button", { name: "Open menu" }).click()
    await page
      .getByRole("navigation", { name: "account" })
      .getByRole("button", { name: /^send feedback/ })
      .click()

    const sheet = page.getByRole("dialog", { name: "send feedback" })
    await expect(sheet).toBeVisible()
    const send = sheet.getByRole("button", { name: "send", exact: true })
    await expect(send).toBeDisabled()

    await sheet.getByRole("radio", { name: "bug" }).click()
    await sheet
      .getByRole("textbox", { name: "your feedback" })
      .fill("the join button does nothing")
    await send.click()

    await expect(page.getByText("thanks, we got it")).toBeVisible()
    await expect(sheet).toBeHidden()
    expect(backend.feedbackRequests).toHaveLength(1)
    expect(backend.feedbackRequests[0]).toMatchObject({
      kind: "bug",
      message: "the join button does nothing",
      page: "/",
    })
  })

  test("the faq page opens the same sheet", async ({ page }) => {
    await stubBackend(page)
    await page.goto("/menu/faq-feedback")

    await page.getByRole("button", { name: "send feedback" }).click()

    await expect(
      page.getByRole("dialog", { name: "send feedback" })
    ).toBeVisible()
  })
})
