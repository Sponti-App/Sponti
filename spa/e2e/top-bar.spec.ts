import { expect, test, type Locator, type Page } from "@playwright/test"
import { STUB_USER, stubBackend } from "./support/stubs"

// #369: settings and profile editing live in the menu, an "invite" pill
// replaces the settings cog on the home header and opens the share sheet on
// the invite link (with the qr one tab away), and the friends screen leads
// with your handle card.

const drawer = (page: Page) => page.getByRole("complementary", { name: "Menu" })
const inviteDialog = (page: Page) =>
  page.getByRole("dialog", { name: "invite a friend" })

async function expectMenuContents(menu: Locator) {
  await expect(
    menu.getByRole("link", { name: new RegExp(STUB_USER.displayName) })
  ).toHaveAttribute("href", "/settings/profile")
  await expect(
    menu.getByRole("link", { name: /@flaretester · edit profile/ })
  ).toBeVisible()
  await expect(menu.getByRole("link", { name: /^settings/ })).toHaveAttribute(
    "href",
    "/settings"
  )
  for (const label of ["about sponti", "faq & feedback", "support"]) {
    await expect(menu.getByRole("link", { name: label })).toBeVisible()
  }
  // The legal pages are the quiet row at the foot, not full rows.
  const legal = menu.getByRole("navigation", { name: "legal" })
  for (const label of ["impressum", "privacy", "terms"]) {
    await expect(legal.getByRole("link", { name: label })).toBeVisible()
  }
  await expect(menu.getByRole("link", { name: "privacy note" })).toHaveCount(0)
}

test.describe("top bar (#369)", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page)
  })

  test("the home header has the invite pill, not a settings cog", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("button", { name: "invite", exact: true })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0)
  })

  test("the drawer holds the profile card, settings and the legal row", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Open menu" }).click()

    await expect(drawer(page)).toBeVisible()
    await expectMenuContents(drawer(page))

    await drawer(page)
      .getByRole("link", { name: /^settings/ })
      .click()
    await expect(page).toHaveURL(/\/settings$/)
  })

  test("the drawer's profile card opens edit profile", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Open menu" }).click()
    await drawer(page)
      .getByRole("link", { name: new RegExp(STUB_USER.displayName) })
      .click()

    await expect(page).toHaveURL(/\/settings\/profile$/)
  })

  test("/menu mirrors the drawer", async ({ page }) => {
    await page.goto("/menu")
    await expectMenuContents(page.getByRole("main"))
  })

  test("invite opens the sheet on the link, then the qr is one tab away", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "invite", exact: true }).click()

    const sheet = inviteDialog(page)
    await expect(sheet).toBeVisible()
    await expect(
      sheet.getByRole("tab", { name: "invite link" })
    ).toHaveAttribute("aria-selected", "true")
    await expect(sheet.locator("[data-invite-url]")).toContainText(
      "/invite/e2e-invite"
    )
    await expect(
      sheet.getByRole("button", { name: "share link" })
    ).toBeEnabled()
    await expect(sheet.getByAltText(/^QR code for @/)).toHaveCount(0)

    await sheet.getByRole("tab", { name: "qr code" }).click()
    await expect(sheet.getByRole("tab", { name: "qr code" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(
      sheet.getByAltText(`QR code for @${STUB_USER.username}`)
    ).toBeVisible()
    // Only the link tab has the peach share button.
    await expect(sheet.getByRole("button", { name: "share link" })).toHaveCount(
      0
    )

    await sheet.getByRole("button", { name: "Close", exact: true }).click()
    await expect(sheet).toHaveCount(0)
  })

  test("the friends screen leads with the handle card", async ({ page }) => {
    await page.goto("/circles")

    const card = page.locator("[data-handle-card]")
    await expect(card).toContainText(`@${STUB_USER.username}`)
    // The lone qr icon in the header is gone.
    await expect(
      page.getByRole("button", { name: "Show your QR" })
    ).toHaveCount(0)

    await card.getByRole("button", { name: "share" }).click()
    await expect(
      page.getByRole("tab", { name: "invite link" })
    ).toHaveAttribute("aria-selected", "true")
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByRole("tab", { name: "invite link" })).toHaveCount(0)

    await card.getByRole("button", { name: "qr code" }).click()
    await expect(page.getByRole("tab", { name: "qr code" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(
      page.getByAltText(`QR code for @${STUB_USER.username}`)
    ).toBeVisible()

    await page.getByRole("button", { name: "Close", exact: true }).click()
    await card.getByRole("link", { name: "settings" }).click()
    await expect(page).toHaveURL(/\/settings$/)
  })
})
