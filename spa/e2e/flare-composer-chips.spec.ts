import { expect, test, type Page } from "@playwright/test"
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

  // #447: the limit caps open-to-all flares; on invite-only it does nothing.
  test("the guest-limit stepper shows only when public is on", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "all friends · 12" }).click()
    const publicSwitch = page.getByRole("switch").first()
    const increase = page.getByRole("button", { name: "increase" })
    await expect(publicSwitch).not.toBeChecked()
    await expect(increase).toHaveCount(0)

    await publicSwitch.click()
    await expect(publicSwitch).toBeChecked()
    await expect(increase).toBeVisible()
    await expect(page.getByText("limit", { exact: true })).toBeVisible()

    await publicSwitch.click()
    await expect(increase).toHaveCount(0)
  })

  // #584: one sideways-scrolling row, not wrapped rows that push the friend
  // search below the fold.
  test.describe("circle row (#584)", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole("button", { name: "all friends · 12" }).click()
    })

    const row = (page: Page) => page.locator("[data-circle-row]")

    test("the circles sit on one line, fade where more are hidden, and the friend search stays in view", async ({
      page,
    }) => {
      const chips = row(page).getByRole("button")
      await expect(chips).toHaveCount(4)
      const ys = await chips.evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().top))
      )
      expect(new Set(ys).size, "chips wrapped").toBe(1)
      await expect(row(page)).toHaveAttribute("data-overflow-after", "true")
      await expect(
        page.getByRole("button", { name: /also invite specific friends/ })
      ).toBeInViewport()
    })

    test("a pan over the chips scrolls the row without selecting or editing", async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name === "desktop", "touch only")
      const inner = row(page).getByRole("button", { name: /inner circle/ })
      // The sheet animates to its taller snap; hover waits for it to settle.
      await inner.hover()
      const box = (await inner.boundingBox())!
      const y = box.y + box.height / 2
      const cdp = await page.context().newCDPSession(page)
      const touch = (
        type: "touchStart" | "touchMove" | "touchEnd",
        x: number
      ) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        })
      const startX = box.x + box.width - 4
      await touch("touchStart", startX)
      for (let i = 1; i <= 8; i++) await touch("touchMove", startX - i * 25)
      await touch("touchEnd", startX - 200)

      await expect
        .poll(() => row(page).evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0)
      await expect(
        page.getByRole("button", { name: "all friends · 12" })
      ).toBeVisible()
      await expect(page.getByText(/^editing /)).toHaveCount(0)
    })

    test("holding inner circle still opens its editor", async ({ page }) => {
      const inner = row(page).getByRole("button", { name: /inner circle/ })
      // The sheet animates to its taller snap; hover waits for it to settle.
      await inner.hover()
      const box = (await inner.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(700)
      await page.mouse.up()
      await expect(page.getByText("editing inner circle")).toBeVisible()
    })
  })
})
