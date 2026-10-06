import { expect, test, type Page } from "@playwright/test"
import { stubBackend } from "../support/stubs"

// #377: with `introV2` (the full profile), a signed-out visitor's first open
// of the home map starts with three intro slides: what sponti is, why it
// exists, how lighting a flare works. They show once per device. "look
// around" and skip go to the map, "i have an account" to /login.

const slides = (page: Page) => page.locator("[data-intro-slide]")
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const title = (page: Page) => slides(page).getByRole("heading", { level: 1 })

async function firstOpen(page: Page) {
  await stubBackend(page, { signedOut: true, introSlides: true })
  await page.goto("/")
  await expect(slides(page)).toBeVisible()
}

test.describe("intro slides (#377)", () => {
  test("first open: what, why, how, then look around lands on the map, and a second open skips them", async ({
    page,
  }) => {
    await firstOpen(page)

    await expect(slides(page)).toHaveAttribute("data-intro-slide", "what")
    await expect(slides(page).getByText("what sponti is")).toBeVisible()
    await expect(title(page)).toHaveText(
      "plans with friends, right now or soon"
    )

    await slides(page).getByRole("button", { name: "next" }).click()
    await expect(title(page)).toHaveText(
      "we're more connected than ever, and more alone"
    )
    await expect(
      slides(page).getByRole("link", {
        name: "who commission on social connection (2025)",
      })
    ).toHaveAttribute(
      "href",
      "https://www.who.int/publications/i/item/978240112360"
    )

    await slides(page).getByRole("button", { name: "next" }).click()
    await expect(title(page)).toHaveText("light a flare")
    await expect(
      slides(page).getByRole("button", { name: "skip" })
    ).toHaveCount(0)

    await slides(page).getByRole("button", { name: "look around" }).click()
    await expect(slides(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/$/)
    await expect(nav(page)).toBeVisible()
    await expect(page.getByRole("button", { name: "sign in" })).toBeVisible()

    // Once per device.
    await page.reload()
    await expect(nav(page)).toBeVisible()
    await expect(page.getByRole("button", { name: "sign in" })).toBeVisible()
    await expect(slides(page)).toHaveCount(0)
  })

  test("skip goes straight to the map", async ({ page }) => {
    await firstOpen(page)

    await slides(page).getByRole("button", { name: "skip" }).click()
    await expect(slides(page)).toHaveCount(0)
    await expect(nav(page)).toBeVisible()
  })

  test("the dots and the arrow keys move between slides, and Escape skips", async ({
    page,
  }) => {
    await firstOpen(page)

    await slides(page).getByRole("button", { name: "slide 3 of 3" }).click()
    await expect(slides(page)).toHaveAttribute("data-intro-slide", "how")
    await page.keyboard.press("ArrowLeft")
    await expect(slides(page)).toHaveAttribute("data-intro-slide", "why")
    await page.keyboard.press("ArrowRight")
    await expect(slides(page)).toHaveAttribute("data-intro-slide", "how")

    await page.keyboard.press("Escape")
    await expect(slides(page)).toHaveCount(0)
    await expect(nav(page)).toBeVisible()
  })

  test("i have an account goes to sign in, and the slides don't come back", async ({
    page,
  }) => {
    await firstOpen(page)

    await slides(page)
      .getByRole("button", { name: "i have an account" })
      .click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto("/")
    await expect(nav(page)).toBeVisible()
    await expect(slides(page)).toHaveCount(0)
  })

  test("nothing moves under reduced motion", async ({ page }) => {
    const grainAnimation = () =>
      page
        .locator(".intro-grain")
        .evaluate((el) => getComputedStyle(el).animationName)

    await firstOpen(page)
    expect(await grainAnimation()).toBe("intro-grain")

    await page.emulateMedia({ reducedMotion: "reduce" })
    expect(await grainAnimation()).toBe("none")
    const moving = await slides(page).evaluate(
      (root) =>
        Array.from(root.querySelectorAll("*")).filter(
          (el) => getComputedStyle(el).animationName !== "none"
        ).length
    )
    expect(moving).toBe(0)
  })

  test("a signed-in user never sees them", async ({ page }) => {
    await stubBackend(page, { introSlides: true })
    await page.goto("/")
    await expect(nav(page)).toBeVisible()
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible()
    await expect(slides(page)).toHaveCount(0)
  })
})
