import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #129 / #126: the privacy note is readable signed out (registration links
// to it), and every support path is a mailto to the one contact address with
// the build and device pre-filled.

test.describe("privacy note and support (#129, #126)", () => {
  test("the privacy note opens signed out and says it's a test build", async ({
    page,
  }) => {
    await page.goto("/menu/privacy")

    await expect(
      page.getByRole("heading", { name: "sponti is a test build." })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /@sponti\./ }).first()
    ).toHaveAttribute("href", /^mailto:.+@.+/)
    await expect(page.getByText("example.com")).toHaveCount(0)
  })

  test("registration links to the terms and the privacy note", async ({
    page,
  }) => {
    await page.goto("/register")

    await page.getByRole("link", { name: "privacy note" }).click()

    await expect(page).toHaveURL(/\/menu\/privacy$/)
    await expect(
      page.getByRole("heading", { name: "delete your data" })
    ).toBeVisible()
  })

  test("support mails the one address with build and device filled in", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/menu/support")

    const hrefs = await page
      .locator('a[href^="mailto:"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""))

    expect(hrefs.length).toBeGreaterThan(1)
    const addresses = new Set(hrefs.map((h) => new URL(h).pathname))
    expect(addresses.size).toBe(1)

    const body = new URL(hrefs[0]).searchParams.get("body") ?? ""
    expect(body).toContain("sponti build:")
    expect(body).toContain("browser:")
    expect(body).toContain("screen:")
  })
})
