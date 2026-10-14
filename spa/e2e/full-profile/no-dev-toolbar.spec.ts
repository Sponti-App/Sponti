import { expect, test } from "@playwright/test"
import { stubBackend } from "../support/stubs"

// #520: same as ../no-dev-toolbar.spec.ts, for the full-profile server, which
// has its own env in playwright.config.ts.
test.describe("dev-only toolbar (#520)", () => {
  test("does not mount in the full-profile e2e server", async ({ page }) => {
    await stubBackend(page)
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("agentation-toolbar, [data-agentation-root]")
    ).toHaveCount(0)
  })
})
