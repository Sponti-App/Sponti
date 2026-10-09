import { expect, test, type Page } from "@playwright/test"
import { BERLIN_COORDS, stubBackend } from "../support/stubs"

// #497: with `coachMarks` (the full profile), the signed-in home map runs two
// more coach marks once per device: the circles tab, then the menu. They have
// their own seen key, so the signed-out run (#379) doesn't block them, and
// they wait for the post-sign-up checklist (#459) and any open sheet.

const ONBOARDING_KEY = "sponti.onboarding.v1"
const HOME_KEY = "sponti.coach-marks.home.v1"

const mark = (page: Page) => page.locator("[data-coach-mark]")

async function openHome(page: Page, options: { checklist?: boolean } = {}) {
  await stubBackend(page, {
    coords: BERLIN_COORDS,
    homeCoachMarks: true,
  })
  if (options.checklist) {
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, "pending"),
      ONBOARDING_KEY
    )
  }
  await page.goto("/")
}

test.describe("signed-in coach marks (#497)", () => {
  test("circles tab, then the menu, once per device", async ({ page }) => {
    await openHome(page)

    await expect(mark(page)).toHaveAttribute("data-coach-mark", "circles")
    await expect(mark(page).getByText("1 of 2")).toBeVisible()
    // The spotlight only exists while the target does.
    await expect(mark(page).locator("[data-coach-spotlight]")).toBeVisible()
    await expect(
      mark(page).getByText("your circles", { exact: true })
    ).toBeVisible()
    await expect(
      mark(page).getByText(
        "friends and circles live here, and it's where you add people."
      )
    ).toBeVisible()

    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "menu")
    await expect(mark(page).getByText("2 of 2")).toBeVisible()
    await expect(mark(page).locator("[data-coach-spotlight]")).toBeVisible()
    await expect(mark(page).getByText("menu", { exact: true })).toBeVisible()
    await expect(
      mark(page).getByText("your profile and settings are in here.")
    ).toBeVisible()

    await mark(page).getByRole("button", { name: "got it" }).click()
    await expect(mark(page)).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()
    await expect(mark(page)).toHaveCount(0)
  })

  test("skip marks them seen", async ({ page }) => {
    await openHome(page)

    await expect(mark(page).getByText("1 of 2")).toBeVisible()
    await mark(page).getByRole("button", { name: "skip" }).click()
    await expect(mark(page)).toHaveCount(0)
    expect(await page.evaluate((k) => localStorage.getItem(k), HOME_KEY)).toBe(
      "seen"
    )
  })

  test("they wait for the post-sign-up checklist, and show once it's hidden", async ({
    page,
  }) => {
    await openHome(page, { checklist: true })

    const checklist = page.getByRole("region", { name: "get going" })
    await expect(checklist).toBeVisible()
    await expect(mark(page)).toHaveCount(0)

    await checklist.getByRole("button", { name: "hide" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "circles")
  })

  test("the circles mark sits over the nav, not under it", async ({ page }) => {
    await openHome(page)
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "circles")

    // The topmost element over the circles tab is the overlay: the home is
    // a fixed layer of its own, so the marks are portalled above the nav.
    const tab = page.locator(
      'nav[aria-label="Primary"] button[aria-label="Circles"]'
    )
    const box = await tab.boundingBox()
    expect(box).not.toBeNull()
    const onTop = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-coach-mark]") !== null,
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
    )
    expect(onTop).toBe(true)
  })

  test("they don't pop up after something the user opened closes", async ({
    page,
  }) => {
    await openHome(page, { checklist: true })
    const checklist = page.getByRole("region", { name: "get going" })
    await expect(checklist).toBeVisible()

    // The user opens the menu while the checklist is up, then closes it and
    // hides the checklist: the marks wait for the next arrival.
    await page.getByRole("button", { name: "Open menu" }).click()
    // Close it on the scrim, to the right of the drawer.
    await page.mouse.click(page.viewportSize()!.width - 8, 400)
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()
    await checklist.getByRole("button", { name: "hide" }).click()
    await expect(checklist).toBeHidden()
    await page.waitForTimeout(600)
    await expect(mark(page)).toHaveCount(0)

    // The next arrival on the home (a reload would re-run the init script
    // that makes the checklist pending again).
    const nav = page.getByRole("navigation", { name: "Primary" })
    await nav.getByRole("button", { name: "Circles" }).click()
    await expect(page).toHaveURL(/\/circles/)
    await nav.getByRole("button", { name: "Home" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "circles")
  })
})
