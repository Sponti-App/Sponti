import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #520: the e2e servers run `next dev`, where the agentation annotation
// toolbar would mount. It sits over the bottom nav and swallows taps, and its
// inputs break specs that count inputs, so app/layout.tsx skips it when
// E2E_HIDE_DEV_INDICATOR is set (playwright.config.ts sets it on both servers).
// This fails if that guard goes, before the specs that tap the nav do.
test.describe("dev-only toolbar (#520)", () => {
  test("does not mount in the e2e server", async ({ page }) => {
    await stubBackend(page)
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("agentation-toolbar, [data-agentation-root]")
    ).toHaveCount(0)
  })
})
