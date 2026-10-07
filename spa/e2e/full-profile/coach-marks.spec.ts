import { expect, test, type Locator, type Page } from "@playwright/test"
import { stubBackend } from "../support/stubs"

// #379: with `coachMarks` (the full profile), a signed-out visitor's first
// open of the home map runs three coach marks after the intro slides and
// before the location ask (#408): the idea spot, the flare button, then the
// map/calendar toggle. Each has "n of 3", skip and next; skip or "got it"
// goes on to the location ask. They show once per device. With no idea spot
// on screen, that mark is left out ("n of 2").

// A day when the berlin idea spots are in season.
const JUNE = "2026-06-15T12:00:00.000Z"

const slides = (page: Page) => page.locator("[data-intro-slide]")
const mark = (page: Page) => page.locator("[data-coach-mark]")
const locationSheet = (page: Page) => page.locator('[data-sheet="location"]')
const navNode = (page: Page) => page.locator('nav[aria-label="Primary"]')

async function firstOpen(
  page: Page,
  options: { introSlides?: boolean; ideasHidden?: boolean } = {}
) {
  await page.clock.setFixedTime(JUNE)
  if (options.ideasHidden) {
    await page.addInitScript(() =>
      window.localStorage.setItem("sponti.ideas.hidden.v1", "1")
    )
  }
  await stubBackend(page, {
    signedOut: true,
    introSlides: options.introSlides ?? true,
    coachMarks: true,
    locationAsk: true,
  })
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

test.describe("coach marks (#379)", () => {
  test("slides → three marks → the location ask, and a second visit has no marks", async ({
    page,
  }) => {
    await firstOpen(page)

    // The marks wait for the slides.
    await expect(slides(page)).toBeVisible()
    await expect(mark(page)).toHaveCount(0)
    await slides(page).getByRole("button", { name: "next" }).click()
    await slides(page).getByRole("button", { name: "next" }).click()
    await slides(page).getByRole("button", { name: "look around" }).click()
    await expect(slides(page)).toHaveCount(0)

    // 1: the idea spot. The location ask waits.
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "idea")
    await expect(mark(page).getByText("1 of 3")).toBeVisible()
    await expect(
      mark(page).getByText("ideas nearby", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("dialog", { name: "ideas nearby" })
    ).toBeVisible()
    await expect(locationSheet(page)).toHaveCount(0)
    await expectSpotlightOn(page, page.locator("[data-idea-pin]").first())

    // 2: the flare button.
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "flare")
    await expect(mark(page).getByText("2 of 3")).toBeVisible()
    await expect(
      mark(page).getByText("light a flare", { exact: true })
    ).toBeVisible()
    await expect(
      mark(page).getByText(
        "say what you're up to, right now or at a time you pick."
      )
    ).toBeVisible()
    await expectSpotlightOn(
      page,
      navNode(page).locator("[data-nav-flare-circle]")
    )

    // 3: the map/calendar toggle, which ends on "got it".
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "calendar")
    await expect(mark(page).getByText("3 of 3")).toBeVisible()
    await expect(
      mark(page).getByText("soon lives here", { exact: true })
    ).toBeVisible()
    await expect(mark(page).getByRole("button", { name: "next" })).toHaveCount(
      0
    )
    await expectSpotlightOn(page, page.locator('[data-coach="view-toggle"]'))

    await mark(page).getByRole("button", { name: "got it" }).click()
    await expect(mark(page)).toHaveCount(0)
    await expect(
      locationSheet(page).getByText("where should the map start?")
    ).toBeVisible()

    // Once per device: the location ask is still undecided, the marks aren't.
    await page.reload()
    await expect(
      locationSheet(page).getByText("where should the map start?")
    ).toBeVisible()
    await expect(slides(page)).toHaveCount(0)
    await expect(mark(page)).toHaveCount(0)
  })

  test("skip goes straight on to the location ask, and they don't come back", async ({
    page,
  }) => {
    await firstOpen(page, { introSlides: false })

    await expect(mark(page).getByText("1 of 3")).toBeVisible()
    await expect(locationSheet(page)).toHaveCount(0)

    await mark(page).getByRole("button", { name: "skip" }).click()
    await expect(mark(page)).toHaveCount(0)
    await expect(
      locationSheet(page).getByText("where should the map start?")
    ).toBeVisible()

    await page.reload()
    await expect(
      locationSheet(page).getByText("where should the map start?")
    ).toBeVisible()
    await expect(mark(page)).toHaveCount(0)
  })

  test("Escape skips them too", async ({ page }) => {
    await firstOpen(page, { introSlides: false })

    await expect(mark(page).getByText("1 of 3")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(mark(page)).toHaveCount(0)
    await expect(
      locationSheet(page).getByText("where should the map start?")
    ).toBeVisible()
  })

  test("with no idea spot on screen, the idea mark is left out: n of 2", async ({
    page,
  }) => {
    await firstOpen(page, { introSlides: false, ideasHidden: true })

    await expect(mark(page)).toHaveAttribute("data-coach-mark", "flare")
    await expect(mark(page).getByText("1 of 2")).toBeVisible()
    await mark(page).getByRole("button", { name: "next" }).click()
    await expect(mark(page)).toHaveAttribute("data-coach-mark", "calendar")
    await expect(mark(page).getByText("2 of 2")).toBeVisible()
    await mark(page).getByRole("button", { name: "got it" }).click()
    await expect(
      locationSheet(page).getByText("where should the map start?")
    ).toBeVisible()
  })
})
