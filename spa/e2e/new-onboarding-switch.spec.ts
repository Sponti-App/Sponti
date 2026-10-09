import { expect, test, type Page } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #482: in the tester build, the new onboarding is off. Settings has a
// per-device "new onboarding" switch that turns it on, and buttons that
// reset what it remembers. These specs run against the tester build; the
// onboarding itself is covered by e2e/full-profile/.

const SWITCH_KEY = "sponti.new-onboarding.v1"
const INTRO_SLIDES_KEY = "sponti.intro-slides.v1"
const ONBOARDING_KEY = "sponti.onboarding.v1"
const LOCATION_CHOICE_KEY = "sponti.location-choice.v1"
const COACH_MARKS_KEY = "sponti.coach-marks.v1"

const slides = (page: Page) => page.locator("[data-intro-slide]")
const mark = (page: Page) => page.locator("[data-coach-mark]")
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const newOnboarding = (page: Page) =>
  page.getByRole("switch", { name: "new onboarding" })
const stored = (page: Page, key: string) =>
  page.evaluate((k) => window.localStorage.getItem(k), key)

// stubBackend seeds the session on every navigation, so a signed-out
// reload needs the seed skipped. Registered after stubBackend's own script.
async function staySignedOutAfterSignOut(page: Page) {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("e2e-signed-out") !== "1") return
    for (const key of [
      "sponti.auth.access-token.v1",
      "sponti.auth.refresh-token.v1",
      "sponti.auth.user.v1",
    ])
      window.localStorage.removeItem(key)
  })
}

// Signs out from settings and waits to land on `landing`, with no navigation
// of its own: where sign-out goes is what these specs check.
async function signOut(page: Page, landing: RegExp) {
  await page.getByRole("button", { name: "sign out" }).click()
  await expect(page).toHaveURL(landing)
  await page.evaluate(() =>
    window.sessionStorage.setItem("e2e-signed-out", "1")
  )
}

test.describe("new onboarding switch (#482)", () => {
  test("on, then signing out shows the intro slides in the tester build", async ({
    page,
  }) => {
    await stubBackend(page, {
      introSlides: true,
      coachMarks: true,
      locationAsk: true,
    })
    await staySignedOutAfterSignOut(page)
    await page.goto("/settings")

    await expect(newOnboarding(page)).toHaveAttribute("aria-checked", "false")
    await newOnboarding(page).click()
    await expect(newOnboarding(page)).toHaveAttribute("aria-checked", "true")
    expect(await stored(page, SWITCH_KEY)).toBe("on")

    // Straight to the signed-out home, not the login page, and the slides
    // over it.
    await signOut(page, /\/$/)
    await expect(slides(page)).toBeVisible()
    await slides(page).getByRole("button", { name: "skip" }).click()
    // Then the coach marks (#379), then the location ask: the flags are on
    // together.
    await expect(mark(page)).toBeVisible()
    await mark(page).getByRole("button", { name: "skip" }).click()
    await expect(
      page.getByRole("dialog", { name: "where should the map start?" })
    ).toBeVisible()
    await page.getByRole("button", { name: "mitte" }).click()
    await expect(nav(page)).toBeVisible()
    await expect(page.getByRole("button", { name: "sign in" })).toBeVisible()

    // Kept on the device: still on after a reload.
    await page.reload()
    await expect(nav(page)).toBeVisible()
    expect(await stored(page, SWITCH_KEY)).toBe("on")
  })

  // #274: the flags are on in the tester build too, so there is no "off" flow
  // left to compare against.
  test.skip("off, the tester flow is unchanged: signed out goes to /login, no slides", async ({
    page,
  }) => {
    await stubBackend(page, { introSlides: true, locationAsk: true })
    await staySignedOutAfterSignOut(page)
    await page.goto("/settings")

    // Switched on and back off again.
    await newOnboarding(page).click()
    await newOnboarding(page).click()
    await expect(newOnboarding(page)).toHaveAttribute("aria-checked", "false")
    expect(await stored(page, SWITCH_KEY)).toBeNull()

    await signOut(page, /\/login/)
    await page.goto("/")

    await expect(page).toHaveURL(/\/login/)
    await expect(slides(page)).toHaveCount(0)
  })

  test("replay intro resets the slides and the first-run intro, with a toast", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/settings")
    await page.evaluate(
      ([onboardingKey]) => window.localStorage.setItem(onboardingKey, "done"),
      [ONBOARDING_KEY]
    )
    expect(await stored(page, INTRO_SLIDES_KEY)).toBe("seen")

    await page.getByRole("button", { name: "replay intro" }).click()

    await expect(
      page.getByText("intro reset. it shows on the home map")
    ).toBeVisible()
    expect(await stored(page, INTRO_SLIDES_KEY)).toBeNull()
    expect(await stored(page, ONBOARDING_KEY)).toBe("pending")
    // The map tips are their own button.
    expect(await stored(page, LOCATION_CHOICE_KEY)).not.toBeNull()
  })

  test("replay map tips resets the coach marks and the location choice, and says to sign out", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/settings")
    await newOnboarding(page).click()
    expect(await stored(page, COACH_MARKS_KEY)).toBe("seen")
    expect(await stored(page, LOCATION_CHOICE_KEY)).not.toBeNull()

    await page.getByRole("button", { name: "replay map tips" }).click()

    await expect(
      page.getByText("map tips reset. sign out to see them again")
    ).toBeVisible()
    expect(await stored(page, COACH_MARKS_KEY)).toBeNull()
    expect(await stored(page, LOCATION_CHOICE_KEY)).toBeNull()
    expect(await stored(page, INTRO_SLIDES_KEY)).toBe("seen")
  })
})
