import { expect, test, type Locator, type Page } from "@playwright/test"
import { BERLIN_COORDS, stubBackend } from "../support/stubs"

// #379, #497, #560: with `coachMarks` (the full profile), the coach marks run
// once per device, only after sign-in, as one run on the home map: the idea
// spot, the flare button, the now/soon toggle, the circles tab, then the
// menu. Each has "n of 5", skip and next. With no idea spot on screen, that
// mark is left out ("n of 4"). A signed-out visitor gets the intro slides and
// the location ask, and no marks.

// A day when the berlin idea spots are in season.
const JUNE = "2026-06-15T12:00:00.000Z"
const ONBOARDING_KEY = "sponti.onboarding.v1"
const COACH_MARKS_KEY = "sponti.coach-marks.v2"

const slides = (page: Page) => page.locator("[data-intro-slide]")
const mark = (page: Page) => page.locator("[data-coach-mark]")
const locationSheet = (page: Page) => page.locator('[data-sheet="location"]')
const navNode = (page: Page) => page.locator('nav[aria-label="Primary"]')

async function openHome(
  page: Page,
  options: { ideasHidden?: boolean; checklist?: boolean } = {}
) {
  await page.clock.setFixedTime(JUNE)
  if (options.ideasHidden) {
    await page.addInitScript(() =>
      window.localStorage.setItem("sponti.ideas.hidden.v1", "1")
    )
  }
  await stubBackend(page, { coords: BERLIN_COORDS, coachMarks: true })
  if (options.checklist) {
    await page.addInitScript(
      (key) => window.localStorage.setItem(key, "pending"),
      ONBOARDING_KEY
    )
  }
  await page.goto("/")
}

/** The spotlight settles on the target: its centre inside the target's box.
 * Polled, since the spotlight glides from one mark to the next. */
async function expectSpotlightOn(page: Page, target: Locator) {
  await expect
    .poll(async () => {
      const spot = await mark(page)
        .locator("[data-coach-spotlight]")
        .boundingBox()
      const box = await target.boundingBox()
      if (!spot || !box) return { spot, box }
      const cx = spot.x + spot.width / 2
      const cy = spot.y + spot.height / 2
      return (
        (cx >= box.x &&
          cx <= box.x + box.width &&
          cy >= box.y &&
          cy <= box.y + box.height) || { spot, box }
      )
    })
    .toBe(true)
}

test.describe("coach marks (#560)", () => {
  test("signed out: slides, then the location ask, and no marks", async ({
    page,
  }) => {
    await page.clock.setFixedTime(JUNE)
    await stubBackend(page, {
      signedOut: true,
      introSlides: true,
      coachMarks: true,
      locationAsk: true,
    })
    await page.goto("/")

    await expect(slides(page)).toBeVisible()
    await slides(page).getByRole("button", { name: "skip" }).click()
    await expect(slides(page)).toHaveCount(0)

    await expect(
      locationSheet(page).getByText("where should the map start?")
    ).toBeVisible()
    await expect(mark(page)).toHaveCount(0)
  })

  test("signed in: five marks in order, once per device", async ({ page }) => {
    await openHome(page)

    // 1: the idea spot.
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "idea")
    await expect(mark(page).getByText("1 of 5")).toBeVisible()
    await expect(
      page.getByRole("dialog", { name: "ideas nearby" })
    ).toBeVisible()
    await expectSpotlightOn(page, page.locator("[data-idea-pin]").first())

    // 2: the flare button.
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "flare")
    await expect(mark(page).getByText("2 of 5")).toBeVisible()
    await expect(
      mark(page).getByText(
        "say what you're up to, right now or at a time you pick."
      )
    ).toBeVisible()
    await expectSpotlightOn(
      page,
      navNode(page).locator("[data-nav-flare-circle]")
    )

    // 3: the now/soon toggle.
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "calendar")
    await expect(mark(page).getByText("3 of 5")).toBeVisible()
    await expectSpotlightOn(page, page.locator('[data-coach="view-toggle"]'))

    // 4: the circles tab.
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "circles")
    await expect(mark(page).getByText("4 of 5")).toBeVisible()
    await expect(
      mark(page).getByText(
        "friends and circles live here, and it's where you add people."
      )
    ).toBeVisible()
    await expectSpotlightOn(
      page,
      navNode(page).getByRole("button", { name: "circles" })
    )

    // 5: the menu, which ends on "got it".
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "menu")
    await expect(mark(page).getByText("5 of 5")).toBeVisible()
    await expect(mark(page).getByRole("button", { name: "next" })).toHaveCount(
      0
    )
    await expectSpotlightOn(page, page.locator('[data-coach="menu"]'))

    await mark(page).getByRole("button", { name: "got it" }).click()
    await expect(mark(page)).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole("button", { name: "open menu" })).toBeVisible()
    await expect(mark(page)).toHaveCount(0)
  })

  test("skip marks them seen", async ({ page }) => {
    await openHome(page)

    await expect(mark(page).getByText("1 of 5")).toBeVisible()
    await mark(page).getByRole("button", { name: "skip" }).click()
    await expect(mark(page)).toHaveCount(0)
    expect(
      await page.evaluate((k) => localStorage.getItem(k), COACH_MARKS_KEY)
    ).toBe("seen")
  })

  test("Escape skips them too", async ({ page }) => {
    await openHome(page)

    await expect(mark(page).getByText("1 of 5")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(mark(page)).toHaveCount(0)
  })

  test("with no idea spot on screen, the idea mark is left out: n of 4", async ({
    page,
  }) => {
    await openHome(page, { ideasHidden: true })

    await expect(mark(page)).toHaveAttribute("data-coach-mark", "flare")
    await expect(mark(page).getByText("1 of 4")).toBeVisible()
  })

  test("they wait for the post-sign-up checklist, and show once it's hidden", async ({
    page,
  }) => {
    await openHome(page, { checklist: true })

    const checklist = page.getByRole("region", { name: "get going" })
    await expect(checklist).toBeVisible()
    await expect(mark(page)).toHaveCount(0)

    await checklist.getByRole("button", { name: "hide" }).click()
    await expect(mark(page)).toBeVisible()
  })

  test("the circles mark sits over the nav, not under it", async ({ page }) => {
    await openHome(page, { ideasHidden: true })
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "flare")
    await mark(page).getByRole("button", { name: "next" }).click()
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "circles")

    // The topmost element over the circles tab is the overlay: the home is
    // a fixed layer of its own, so the marks are portalled above the nav.
    const tab = navNode(page).locator('button[aria-label="circles"]')
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
    await page.getByRole("button", { name: "open menu" }).click()
    // Close it on the scrim, to the right of the drawer.
    await page.mouse.click(page.viewportSize()!.width - 8, 400)
    await expect(page.getByRole("button", { name: "open menu" })).toBeVisible()
    await checklist.getByRole("button", { name: "hide" }).click()
    await expect(checklist).toBeHidden()
    await page.waitForTimeout(600)
    await expect(mark(page)).toHaveCount(0)

    // The next arrival on the home (a reload would re-run the init script
    // that makes the checklist pending again).
    const nav = page.getByRole("navigation", { name: "Primary" })
    await nav.getByRole("button", { name: "circles" }).click()
    await expect(page).toHaveURL(/\/circles/)
    await nav.getByRole("button", { name: "home" }).click()
    await expect(mark(page)).toBeVisible()
  })
})
