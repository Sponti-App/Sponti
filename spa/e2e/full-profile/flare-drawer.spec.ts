import { expect, test, type Page } from "@playwright/test"
import { makeStubFlare, stubBackend } from "../support/stubs"

// #615: one flare detail, a drawer over the home map (the full profile has
// `flareDrawer` on). The map's rail and pins open it, `/event/<id>` opens it
// too, closing goes back to where the person came from, and directions are
// a choice rather than a jump to google maps.

const inMinutes = (min: number) =>
  new Date(Date.now() + min * 60_000).toISOString()

const FLARE = makeStubFlare({
  _id: "0123456789abcdef01234567",
  title: "drinks after work",
  startAt: inMinutes(-10),
  endAt: inMinutes(90),
})

const drawer = (page: Page) =>
  page.locator(`[data-flare-drawer="${FLARE._id}"]`)
const primaryNav = (page: Page) => page.locator('nav[aria-label="Primary"]')
// The drawer's visible title (vaul also renders a screen-reader one).
const title = (page: Page) =>
  drawer(page).locator("h2:not(.sr-only)", { hasText: "drinks after work" })

async function openFromRail(page: Page) {
  await stubBackend(page, { mapEvents: [FLARE] })
  await page.goto("/")
  await page
    .getByRole("region", { name: "flares near you" })
    .getByText("drinks after work")
    .click()
  await expect(drawer(page)).toBeVisible()
  await expect(title(page)).toBeVisible()
}

test.describe("flare drawer (#615)", () => {
  // The first visit compiles the home map and the drawer in dev.
  test.slow()

  test("opens over the map from the rail, under a nav that stays tappable", async ({
    page,
  }) => {
    await openFromRail(page)
    await expect(drawer(page)).toHaveAttribute("data-snap", "half")
    // The map's dock steps aside while the drawer is open.
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeHidden()

    const navBox = await primaryNav(page).boundingBox()
    if (!navBox) throw new Error("expected the nav")
    const hitsNav = await primaryNav(page).evaluate((el, box) => {
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2
      )
      return hit ? el.contains(hit) : false
    }, navBox)
    expect(hitsNav).toBe(true)
  })

  test("closes back to the map, and the url stays the home map", async ({
    page,
  }) => {
    await openFromRail(page)
    await drawer(page).getByRole("button", { name: "close" }).click()
    await expect(drawer(page)).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeVisible()
  })

  test("directions offer the in-app route or google maps, never a direct jump", async ({
    page,
  }) => {
    await openFromRail(page)
    const maps = drawer(page).getByRole("link", { name: /google maps/ })
    await expect(maps).toBeHidden()
    await drawer(page)
      .getByRole("button", { name: /directions/ })
      .click()
    await expect(maps).toBeVisible()
    await expect(maps).toHaveAttribute("target", "_blank")
    await expect(
      drawer(page).getByRole("button", { name: "see route" })
    ).toBeVisible()
  })

  test("/event/<id> opens the drawer on the home map; closing a cold link stays home", async ({
    page,
  }) => {
    await stubBackend(page, { mapEvents: [FLARE] })
    await page.goto(`/event/${FLARE._id}`)
    await expect(page).toHaveURL(new RegExp(`/\\?flare=${FLARE._id}$`))
    await expect(drawer(page)).toBeVisible()
    await expect(title(page)).toBeVisible()

    await drawer(page).getByRole("button", { name: "close" }).click()
    await expect(drawer(page)).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
  })

  test("an updates link opens the drawer at full on the updates tab", async ({
    page,
  }) => {
    await stubBackend(page, { mapEvents: [FLARE] })
    await page.goto(`/event/${FLARE._id}?tab=updates`)
    await expect(page).toHaveURL(
      new RegExp(`/\\?flare=${FLARE._id}&tab=updates$`)
    )
    await expect(drawer(page)).toHaveAttribute("data-snap", "full")
    await expect(
      drawer(page).getByRole("tab", { name: /updates/, selected: true })
    ).toBeVisible()
  })
})
