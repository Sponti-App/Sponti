import { expect, test, type Page } from "@playwright/test"
import {
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "./support/stubs"

// #244: the curated idea spots show as muted pins on the normal map, chip on
// or off. The list has date-dependent seasons, so the clock is fixed to a
// day when four spots near humboldthain are in season (roses, karaoke, the
// prater beer garden and the deck 5 roof). With more than five ideas near, the
// map shows the first five (MAX_IDEA_PINS): in-season first, then nearest.
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

    await expect(pins(page)).toHaveCount(5)
    await expect(pin(page, ROSES)).toBeVisible()
    await expect(pin(page, BEER)).toBeVisible()
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
    await expect(pins(page)).toHaveCount(5)

    await chip(page, "hobby").click()
    await expect(pin(page, FLEA)).toBeVisible()
    await expect(pin(page, BEER)).toHaveCount(0)

    // Another category: its own pins, and its quiet card is an idea.
    await chip(page, "hobby").click()
    await chip(page, "food").click()
    await expect(pins(page)).toHaveCount(5)
    await expect(pin(page, FLEA)).toHaveCount(0)
    await expect(quietCard(page)).toHaveAttribute("data-quiet-card", "idea")

    // Two chips: the union.
    await chip(page, "food").click()
    await chip(page, "hobby").click()
    await expect(pin(page, FLEA)).toBeVisible()
    await chip(page, "drinks").click()
    await expect(pin(page, FLEA)).toBeVisible()
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
    // A flare right on the prater beer garden.
    await openBerlinMap(page, [
      makeStubFlare({
        _id: "e-beer",
        title: "beer run",
        type: "drinks",
        location: {
          type: "Point",
          coordinates: [13.4095113, 52.5402446],
        },
      }),
    ])
    await expect(pin(page, ROSES)).toBeVisible()
    await expect(pin(page, BEER)).toHaveCount(0)
    // The hidden idea gives its slot to the next one.
    await expect(pins(page)).toHaveCount(5)
  })
})

// #245: one tap hides ideas on this device, and settings brings them back.
test.describe("hide ideas (#245)", () => {
  const hideButton = (page: Page) =>
    quietCard(page).getByRole("button", { name: "hide ideas" })
  const settingsSwitch = (page: Page) =>
    page.getByRole("switch", { name: "show ideas on the map" })

  test("hide ideas on a pin's card removes every pin and the card", async ({
    page,
  }) => {
    await openBerlinMap(page)
    await expect(pins(page)).toHaveCount(5)

    await pin(page, BEER).click()
    await hideButton(page).click()

    await expect(pins(page)).toHaveCount(0)
    await expect(quietCard(page)).toBeHidden()
    await expect(page.getByText(/ideas hidden/)).toBeVisible()
    // Back to the rail, and a chip with an idea nearby now gets the generic
    // card instead of the idea card.
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeVisible()
    await chip(page, "drinks").click()
    await expect(quietCard(page)).toHaveAttribute("data-quiet-card", "generic")
    await expect(quietCard(page).getByText("up for drinks?")).toBeVisible()
    await expect(hideButton(page)).toHaveCount(0)
  })

  test("hide ideas on the quiet idea card, and undo from the toast", async ({
    page,
  }) => {
    await openBerlinMap(page)
    await chip(page, "drinks").click()
    await expect(quietCard(page)).toHaveAttribute("data-quiet-card", "idea")

    await hideButton(page).click()
    await expect(quietCard(page)).toHaveAttribute("data-quiet-card", "generic")
    await expect(pins(page)).toHaveCount(0)

    await page.getByRole("button", { name: "undo" }).click()
    await expect(quietCard(page)).toHaveAttribute("data-quiet-card", "idea")
    await expect(pin(page, BEER)).toBeVisible()
  })

  test("the choice is kept across a reload, and the setting brings ideas back", async ({
    page,
  }) => {
    await openBerlinMap(page)
    await pin(page, BEER).click()
    await hideButton(page).click()
    await expect(pins(page)).toHaveCount(0)

    await page.reload()
    await expect(nav(page)).toBeVisible()
    // Same map, same position, same day: only the choice differs.
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeVisible()
    await expect(pins(page)).toHaveCount(0)
    expect(
      await page.evaluate(() =>
        window.localStorage.getItem("sponti.ideas.hidden.v1")
      )
    ).toBe("1")

    // The setting shows it off, and flipping it back on restores the pins.
    await page.goto("/settings")
    await expect(settingsSwitch(page)).toHaveAttribute("aria-checked", "false")
    await settingsSwitch(page).click()
    await expect(settingsSwitch(page)).toHaveAttribute("aria-checked", "true")

    await page.getByRole("button", { name: "Back", exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(nav(page)).toBeVisible()
    await expect(pins(page)).toHaveCount(5)
  })

  test("the setting can also hide them", async ({ page }) => {
    await openBerlinMap(page)
    await expect(pins(page)).toHaveCount(5)

    await page.goto("/settings")
    await expect(settingsSwitch(page)).toHaveAttribute("aria-checked", "true")
    await settingsSwitch(page).click()

    await page.getByRole("button", { name: "Back", exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(nav(page)).toBeVisible()
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeVisible()
    await expect(pins(page)).toHaveCount(0)
  })
})
