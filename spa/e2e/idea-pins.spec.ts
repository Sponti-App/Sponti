import { expect, test, type Page } from "@playwright/test"
import {
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "./support/stubs"

// #244: the curated idea spots show as muted pins on the normal map, chip on
// or off. The list has date-dependent seasons, so the clock is fixed to a
// day when four spots near humboldthain are in season.
const JUNE = "2026-06-15T12:00:00.000Z"

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const dock = (page: Page) => page.locator("[data-map-dock]")
const chip = (page: Page, name: string) =>
  dock(page).getByRole("button", { name, exact: true })
const pins = (page: Page) => page.locator("[data-idea-pin]")
const pin = (page: Page, title: string) =>
  page.getByRole("button", { name: `idea: ${title}` })
const quietCard = (page: Page) => page.locator("[data-quiet-card]")
const composerTitle = (page: Page) =>
  page.getByPlaceholder("what's the plan? e.g. drinks after work")

const ROSES = "roses are blooming at humboldthain"
const BEER = "beer garden evening at prater"
const FLEA = "hunt for treasure at the mauerpark flea market"

async function openBerlinMap(page: Page, mapEvents: StubApiEvent[] = []) {
  await page.clock.setFixedTime(JUNE)
  await stubBackend(page, { mapEvents, coords: BERLIN_COORDS })
  await page.goto("/")
  await expect(nav(page)).toBeVisible()
}

test.describe("idea pins on the map (#244)", () => {
  test("show on a quiet, unfiltered map, and never read as a flare", async ({
    page,
  }) => {
    await openBerlinMap(page)

    await expect(pins(page)).toHaveCount(4)
    await expect(pin(page, ROSES)).toBeVisible()
    await expect(pin(page, BEER)).toBeVisible()
    await expect(pin(page, FLEA)).toBeVisible()
    // No chip is on and there is no quiet card yet.
    await expect(quietCard(page)).toBeHidden()

    // Muted, dashed and without the peach that marks a flare.
    const style = await pin(page, ROSES)
      .locator("div > div")
      .evaluate((el) => {
        const cs = getComputedStyle(el)
        return { border: cs.borderTopStyle, color: cs.borderTopColor }
      })
    expect(style.border).toBe("dashed")
    const accent = await page.evaluate(() => {
      const probe = document.createElement("span")
      probe.style.color = "var(--accent)"
      document.body.appendChild(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
    expect(style.color).not.toBe(accent)
  })

  test("with a chip on, only that category's ideas are pinned", async ({
    page,
  }) => {
    await openBerlinMap(page)
    await expect(pins(page)).toHaveCount(4)

    await chip(page, "hobby").click()
    await expect(pins(page)).toHaveCount(1)
    await expect(pin(page, FLEA)).toBeVisible()

    // A category with no idea nearby: no pins, and the generic card.
    await chip(page, "hobby").click()
    await chip(page, "food").click()
    await expect(pins(page)).toHaveCount(0)
    await expect(quietCard(page)).toHaveAttribute("data-quiet-card", "generic")

    // Two chips: the union.
    await chip(page, "hobby").click()
    await expect(pin(page, FLEA)).toBeVisible()
    await chip(page, "drinks").click()
    await expect(pins(page)).toHaveCount(2)
    await expect(pin(page, BEER)).toBeVisible()
  })

  test("tapping a pin opens the idea card, and light a flare fills the composer", async ({
    page,
  }) => {
    await openBerlinMap(page)

    await pin(page, BEER).click()
    const card = quietCard(page)
    await expect(card).toHaveAttribute("data-quiet-card", "idea")
    await expect(card.getByText(BEER)).toBeVisible()
    await expect(card.getByText(/Prater Biergarten/)).toBeVisible()
    await expect(card.getByText("idea", { exact: true })).toBeVisible()

    // Closing it puts the rail back.
    await card.getByRole("button", { name: "close idea" }).click()
    await expect(card).toBeHidden()
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeVisible()

    await pin(page, BEER).click()
    await card.getByRole("button", { name: "light a flare" }).click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue(BEER)
    await expect(page.getByText("type · drinks")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Prater Biergarten" })
    ).toBeVisible()
  })

  test("an unsent draft is kept when an idea is lit", async ({ page }) => {
    await openBerlinMap(page)

    await page.getByRole("button", { name: "flare", exact: true }).click()
    await composerTitle(page).fill("my own plan")
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(composerTitle(page)).toBeHidden()

    await pin(page, BEER).click()
    await quietCard(page).getByRole("button", { name: "light a flare" }).click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue("my own plan")
  })

  test("a real flare wins: an idea under a flare's pin is not drawn", async ({
    page,
  }) => {
    // A flare right on the flea market.
    await openBerlinMap(page, [
      makeStubFlare({
        _id: "e-flea",
        title: "flea market run",
        type: "hobby",
        location: {
          type: "Point",
          coordinates: [13.4023137, 52.5415157],
        },
      }),
    ])
    await expect(pin(page, ROSES)).toBeVisible()
    await expect(pin(page, FLEA)).toHaveCount(0)
    await expect(pins(page)).toHaveCount(3)
  })
})
