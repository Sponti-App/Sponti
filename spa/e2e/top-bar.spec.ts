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

// #495: on an iPhone with the browser toolbar showing, the visible area is
// about 390x664. The friends screen is taller than that once there are a few
// circles, and the sheet used to sit at the bottom of the page, under the fold.
test.describe("the invite sheet fits the visible viewport (#495)", () => {
  test.use({ viewport: { width: 390, height: 664 } })

  test("friends screen with many circles: the whole qr code shows without scrolling", async ({
    page,
  }) => {
    await stubBackend(page, {
      friends: 12,
      circles: [
        { _id: "c-all", name: "all friends", type: "all", memberCount: 12 },
        { _id: "c-inner", name: "inner", type: "inner", memberCount: 3 },
        { _id: "c-close", name: "close", type: "close", memberCount: 5 },
        ...Array.from({ length: 8 }, (_, i) => ({
          _id: `c-${i}`,
          name: `custom ${i}`,
          type: "custom" as const,
          memberCount: 4,
        })),
      ],
    })
    await page.goto("/circles")
    await page
      .locator("[data-handle-card]")
      .getByRole("button", { name: "qr code" })
      .click()

    const viewport = page.viewportSize()!
    const qr = page.getByAltText(`QR code for @${STUB_USER.username}`)
    await expect(qr).toBeVisible()
    const box = (await qr.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)

    // The sheet itself ends at the screen's bottom edge and stays on screen.
    const sheet = inviteDialog(page)
    const sheetBox = (await sheet.boundingBox())!
    expect(sheetBox.y).toBe(0)
    expect(sheetBox.height).toBeLessThanOrEqual(viewport.height)
  })

  test("a shorter screen scrolls the sheet's body instead of cutting it off", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 480 })
    await stubBackend(page)
    await page.goto("/")
    await page.getByRole("button", { name: "invite", exact: true }).click()
    const sheet = inviteDialog(page)
    await sheet.getByRole("tab", { name: "qr code" }).click()
    const qr = sheet.getByAltText(`QR code for @${STUB_USER.username}`)
    await expect(qr).toBeVisible()

    const heading = sheet.getByText("invite a friend", { exact: true })
    const headingBox = (await heading.boundingBox())!
    expect(headingBox.y).toBeGreaterThanOrEqual(0)

    await qr.scrollIntoViewIfNeeded()
    const box = (await qr.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(480)
  })
})
