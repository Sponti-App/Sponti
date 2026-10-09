import { expect, test, type Page } from "@playwright/test"
import { ANYWHERE_IDEAS } from "../lib/flare-ideas.anywhere.data"
import {
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "./support/stubs"

// #515: place-less "floating" ideas around the person's own position, so the
// map is never empty. The signed-out map has its own spec in full-profile/
// (it needs the full feature profile). The pick is seeded by the day and the
// 3-hour slot on the device clock, so the clock and the timezone are fixed.
test.use({ timezoneId: "Europe/Berlin" })
// 19:00 in berlin, a june evening.
const EVENING = "2026-06-15T17:00:00.000Z"

const TITLES = new Set(ANYWHERE_IDEAS.map((i) => i.title))

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const dock = (page: Page) => page.locator("[data-map-dock]")
const chip = (page: Page, name: string) =>
  dock(page).getByRole("button", { name, exact: true })
const floating = (page: Page) => page.locator("[data-floating-idea]")
const spotPins = (page: Page) => page.locator("[data-idea-pin]")
const quietCard = (page: Page) => page.locator("[data-quiet-card]")
const composerTitle = (page: Page) =>
  page.getByPlaceholder("what's the plan? e.g. drinks after work")

async function titlesOf(pins: ReturnType<typeof floating>) {
  const labels = await pins.evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label") ?? "")
  )
  return labels.map((l) => l.replace(/^idea: /, ""))
}

// #522: the chips only show with two flares or more, and a quiet map shows
// the quiet home instead of the rail. These tests are about the idea pins,
// so the map gets two flares of other types about 1.5 km north, clear of
// every idea spot.
function otherFlares(at: string): StubApiEvent[] {
  const now = new Date(at).getTime()
  const north = {
    type: "Point" as const,
    coordinates: [BERLIN_COORDS.lng, BERLIN_COORDS.lat + 0.014] as [
      number,
      number,
    ],
  }
  return (["party", "culture"] as const).map((type) =>
    makeStubFlare({
      _id: `e-${type}`,
      title: `${type} up north`,
      type,
      startAt: new Date(now - 10 * 60_000).toISOString(),
      endAt: new Date(now + 90 * 60_000).toISOString(),
      location: north,
    })
  )
}

async function openMap(page: Page, coords = BERLIN_COORDS) {
  await page.clock.setFixedTime(EVENING)
  await stubBackend(page, { mapEvents: otherFlares(EVENING), coords })
  await page.goto("/")
  await expect(nav(page)).toBeVisible()
}

test.describe("floating ideas on the map (#515)", () => {
  test("a quiet map has three place-less ideas, even where there are no idea spots", async ({
    page,
  }) => {
    // San Francisco: no berlin spot within miles.
    await openMap(page, { lat: 37.7749, lng: -122.4194 })

    await expect(floating(page)).toHaveCount(3)
    await expect(spotPins(page)).toHaveCount(0)
    for (const title of await titlesOf(floating(page))) {
      expect(TITLES.has(title)).toBe(true)
    }
  })

  test("they come on top of the idea spots, without touching them", async ({
    page,
  }) => {
    await openMap(page)
    await expect(floating(page)).toHaveCount(3)
    // June near humboldthain: the spots are capped at five, as in
    // idea-pins.spec.ts.
    await expect(spotPins(page)).toHaveCount(5)
  })

  test("tapping one opens the idea card with no place or distance, and light a flare fills the composer without a place", async ({
    page,
  }) => {
    await openMap(page)
    await expect(floating(page)).toHaveCount(3)
    const [title] = await titlesOf(floating(page))
    const idea = ANYWHERE_IDEAS.find((i) => i.title === title)!

    await page.getByRole("button", { name: `idea: ${title}` }).click()
    const card = quietCard(page)
    await expect(card).toHaveAttribute("data-quiet-card", "idea")
    await expect(card.getByText(title, { exact: true })).toBeVisible()
    await expect(
      card.getByText(/at your place or wherever you are/)
    ).toBeVisible()
    await expect(card.getByText("idea", { exact: true })).toBeVisible()
    // No distance, no place name.
    await expect(card.getByText(/\d\s?(km|m)\b/)).toHaveCount(0)

    // Closing it puts the rail back.
    await card.getByRole("button", { name: "close idea" }).click()
    await expect(card).toBeHidden()
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeVisible()

    await page.getByRole("button", { name: `idea: ${title}` }).click()
    await card.getByRole("button", { name: "light a flare" }).click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue(title)
    await expect(page.getByText(`type · ${idea.category}`)).toBeVisible()
    // No fixed place: the composer keeps its own default, the person's
    // current location.
    await expect(page.getByText("my location").first()).toBeVisible()
  })

  test("a chip narrows them to that category", async ({ page }) => {
    await openMap(page)
    await expect(floating(page)).toHaveCount(3)

    await chip(page, "food").click()
    await expect(floating(page)).toHaveCount(3)
    for (const title of await titlesOf(floating(page))) {
      expect(ANYWHERE_IDEAS.find((i) => i.title === title)?.category).toBe(
        "food"
      )
    }
  })

  test("they follow the show ideas setting", async ({ page }) => {
    await openMap(page)
    await expect(floating(page)).toHaveCount(3)

    const [title] = await titlesOf(floating(page))
    await page.getByRole("button", { name: `idea: ${title}` }).click()
    await quietCard(page).getByRole("button", { name: "hide ideas" }).click()
    await expect(floating(page)).toHaveCount(0)
    await expect(spotPins(page)).toHaveCount(0)

    await page.getByRole("button", { name: "undo" }).click()
    await expect(floating(page)).toHaveCount(3)
  })
})
