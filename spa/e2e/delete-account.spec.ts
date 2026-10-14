import { expect, test } from "@playwright/test"
import { STUB_PASSWORD, stubBackend } from "./support/stubs"

// #449: someone deletes their own account from settings. A wrong password is
// refused in the dialog; the right one deletes it, signs them out and takes
// them home.

const accessToken = (page: import("@playwright/test").Page) =>
  page.evaluate(() => localStorage.getItem("sponti.auth.access-token.v1"))

test.describe("delete account (#449)", () => {
  test("a wrong password is refused and nothing happens", async ({ page }) => {
    const { deleteAccountRequests } = await stubBackend(page)
    await page.goto("/settings")

    await page.getByRole("button", { name: "delete account" }).click()
    const dialog = page.getByRole("dialog", { name: "delete your account" })
    const confirm = dialog.getByRole("button", { name: "delete", exact: true })
    await expect(confirm).toBeDisabled()

    await dialog.getByLabel("your password").fill("not-it")
    await confirm.click()

    await expect(dialog.getByRole("alert")).toHaveText(
      "that password isn't right"
    )
    expect(deleteAccountRequests).toEqual([{ password: "not-it" }])
    expect(await accessToken(page)).not.toBeNull()

    await dialog.getByRole("button", { name: "keep my account" }).click()
    await expect(dialog).toHaveCount(0)
  })

  test("the right password deletes the account and signs out", async ({
    page,
  }) => {
    const { deleteAccountRequests } = await stubBackend(page)
    await page.goto("/settings")

    await page.getByRole("button", { name: "delete account" }).click()
    const dialog = page.getByRole("dialog", { name: "delete your account" })
    await dialog.getByLabel("your password").fill(STUB_PASSWORD)
    await dialog.getByRole("button", { name: "delete", exact: true }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText("your account is deleted")).toBeVisible()
    expect(deleteAccountRequests).toEqual([{ password: STUB_PASSWORD }])
    expect(await accessToken(page)).toBeNull()
  })
})
