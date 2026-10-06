import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

const TITLE_PLACEHOLDER = "what's the plan? e.g. drinks after work"

// #368: at phone width in dark mode, with more friends than the default guest
// limit of 10. The composer opens on "all friends · 12".
test.describe("flare composer chips (#368)", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark" })

  test.beforeEach(async ({ page }) => {
    await stubBackend(page, {
      friends: 12,
      circles: [
        { _id: "c-all", name: "all friends", type: "all", memberCount: 12 },
        { _id: "c-inner", name: "inner circle", type: "inner", memberCount: 3 },
        {
          _id: "c-close",
          name: "close friends",
          type: "close",
          memberCount: 5,
        },
        {
          _id: "c-hike",
          name: "weekend hikers and climbers",
          type: "custom",
          memberCount: 4,
        },
      ],
    })
    await page.goto("/")
    await expect(
      page.getByRole("navigation", { name: "Primary" })
    ).toBeVisible()
    await page.getByRole("button", { name: "flare", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE_PLACEHOLDER)).toBeVisible()
  })

  test("more invitees than the guest limit keeps the who chip neutral", async ({
    page,
  }) => {
    const who = page.getByRole("button", { name: "all friends · 12" })
    await expect(who).toBeVisible()
    // Red is the error colour; inviting more friends than the guest limit
    // is not an error.
    await expect(who).not.toHaveClass(/destructive/)
  })

  test("the title input and its focus ring sit fully inside the scroll area", async ({
    page,
  }) => {
    const input = page.getByPlaceholder(TITLE_PLACEHOLDER)
    await input.focus()
    const scroll = input.locator(
      "xpath=ancestor::div[contains(@class,'overflow-y-auto')][1]"
    )
    const [inputBox, scrollBox] = await Promise.all([
      input.boundingBox(),
      scroll.boundingBox(),
    ])
    // focus-visible:ring-3 paints 3px outside the border box; the scroll
    // area's overflow clips anything above its top edge.
    expect(inputBox!.y - 3).toBeGreaterThanOrEqual(scrollBox!.y)
  })

  test("circle chips show their full names", async ({ page }) => {
    await page.getByRole("button", { name: "all friends · 12" }).click()
    for (const name of [
      "all friends",
      "inner circle",
      "close friends",
      "weekend hikers and climbers",
    ]) {
      const label = page.getByText(name, { exact: true }).last()
      await expect(label).toBeVisible()
      const clipped = await label.evaluate(
        (el) => el.scrollWidth > el.clientWidth
      )
      expect(clipped, `${name} is truncated`).toBe(false)
    }
  })
})
