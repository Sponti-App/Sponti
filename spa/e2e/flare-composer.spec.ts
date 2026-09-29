import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

const TITLE_PLACEHOLDER = "what's the plan? e.g. drinks after work"

test.describe("flare composer", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page)
    await page.goto("/")
    // AuthGate shows a spinner until the stubbed /auth/me resolves and the
    // authenticated chrome (incl. BottomNav) mounts.
    await expect(
      page.getByRole("navigation", { name: "Primary" })
    ).toBeVisible()
  })

  test("opens from the bottom nav with the title input and CTA in view", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "flare", exact: true }).click()

    const titleInput = page.getByPlaceholder(TITLE_PLACEHOLDER)
    const cta = page.getByRole("button", { name: "light a flare", exact: true })

    await expect(titleInput).toBeInViewport()
    await expect(cta).toBeInViewport()
  })

  test("opens from the map FAB with the title input and CTA in view", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Light a flare", exact: true })
      .click()

    const titleInput = page.getByPlaceholder(TITLE_PLACEHOLDER)
    const cta = page.getByRole("button", { name: "light a flare", exact: true })

    await expect(titleInput).toBeInViewport()
    await expect(cta).toBeInViewport()
  })

  test("closing the composer restores nav interactivity and navigation", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "flare", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE_PLACEHOLDER)).toBeInViewport()

    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE_PLACEHOLDER)).toBeHidden()

    // vaul/Radix's Dialog primitive locks the body (pointer-events: none)
    // while the drawer is open/animating out. If it never gets unlocked, the
    // whole app becomes unclickable behind an invisible drawer.
    await expect(async () => {
      const pointerEvents = await page.evaluate(
        () => document.body.style.pointerEvents
      )
      expect(pointerEvents === "" || pointerEvents === "auto").toBe(true)
    }).toPass()

    await page.getByRole("button", { name: "my flares", exact: true }).click()
    await expect(page).toHaveURL(/\/event$/)
  })
})
