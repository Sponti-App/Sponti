import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #582: the filter menu on the my flares page isn't wired to the list yet, so
// the tester build hides it (`myFlaresFilter`, on in the full profile). The
// title stays centred, and the empty state names the nav's flare button.

test.describe("my flares header (#582)", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page)
    await page.goto("/event")
  })

  test("no filter button, and the title stays centred", async ({ page }) => {
    const title = page.getByRole("heading", { name: "flares", exact: true })
    await expect(title).toBeVisible()
    await expect(
      page.getByRole("button", { name: "filter flares" })
    ).toHaveCount(0)

    const box = await title.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error("expected a laid-out title")
    expect(
      Math.abs(box.x + box.width / 2 - viewport.width / 2)
    ).toBeLessThanOrEqual(1)
  })

  test("the empty state points at the flare button, not a +", async ({
    page,
  }) => {
    await expect(page.getByText("nothing yet")).toBeVisible()
    await expect(
      page.getByText("start something with the flare button below")
    ).toBeVisible()
    await expect(page.getByText("the + below")).toHaveCount(0)
  })
})
