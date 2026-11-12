import { expect, test, type Page } from "@playwright/test"
import { BERLIN_COORDS, stubBackend } from "./support/stubs"

// #178: a long-press on the home map (a right-click on desktop) marks the
// pressed point and opens the composer with that place filled in. The stubbed
// setup has no maps key, so this runs on the static map, which is drawn
// around the camera centre: a press in its middle is the camera centre.
// Events are dispatched on the map layer itself, so the header chips and the
// dock floating over it don't take them.

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const mapLayer = (page: Page) => page.locator("[data-lighting-map]")
const marker = (page: Page) => page.locator("[data-pressed-point]")
const composerTitle = (page: Page) =>
  page.getByPlaceholder("what's the plan? e.g. drinks after work")

async function openMap(page: Page, geocode: Record<string, unknown> | null) {
  await stubBackend(page, { coords: BERLIN_COORDS })
  const lookups: URL[] = []
  await page.route("**/api/geocode?**", async (route) => {
    lookups.push(new URL(route.request().url()))
    // A short wait, so the marker can be seen while the place resolves.
    await new Promise((r) => setTimeout(r, 300))
    if (geocode) await route.fulfill({ json: geocode })
    else await route.fulfill({ status: 502, json: { area: null } })
  })
  await page.goto("/")
  await expect(nav(page)).toBeVisible()
  const box = (await mapLayer(page).boundingBox())!
  return {
    lookups,
    middle: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  }
}

async function touch(page: Page, type: string, x: number, y: number, id = 1) {
  await mapLayer(page).dispatchEvent(type, {
    pointerId: id,
    pointerType: "touch",
    isPrimary: id === 1,
    clientX: x,
    clientY: y,
  })
}

test.describe("long-press on the map (#178)", () => {
  test("a held finger opens the composer with the pressed place", async ({
    page,
  }) => {
    const { lookups, middle } = await openMap(page, {
      area: "Gesundbrunnen",
      locality: "Berlin",
    })

    await touch(page, "pointerdown", middle.x, middle.y)
    await expect(marker(page)).toBeVisible()
    await touch(page, "pointerup", middle.x, middle.y)

    await expect(composerTitle(page)).toBeInViewport()
    await expect(
      page.getByRole("button", { name: "Gesundbrunnen" })
    ).toBeVisible()
    expect(lookups).toHaveLength(1)
    expect(Number(lookups[0].searchParams.get("lat"))).toBeCloseTo(
      BERLIN_COORDS.lat,
      4
    )
    expect(Number(lookups[0].searchParams.get("lng"))).toBeCloseTo(
      BERLIN_COORDS.lng,
      4
    )

    // The marker goes with the composer.
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(composerTitle(page)).toBeHidden()
    await expect(marker(page)).toBeHidden()
  })

  test("a finger that pans or pinches opens nothing", async ({ page }) => {
    const { lookups, middle } = await openMap(page, {
      area: "Gesundbrunnen",
      locality: "Berlin",
    })

    await touch(page, "pointerdown", middle.x, middle.y)
    await touch(page, "pointermove", middle.x + 40, middle.y)
    await page.waitForTimeout(700)
    await touch(page, "pointerup", middle.x + 40, middle.y)

    await touch(page, "pointerdown", middle.x, middle.y)
    await touch(page, "pointerdown", middle.x + 80, middle.y + 80, 2)
    await page.waitForTimeout(700)

    await expect(marker(page)).toBeHidden()
    await expect(composerTitle(page)).toBeHidden()
    expect(lookups).toHaveLength(0)
  })

  test("a right-click opens it too, and a failed lookup still fills the place", async ({
    page,
  }) => {
    const { lookups, middle } = await openMap(page, null)

    // A real right-click, in the middle of the map, which nothing covers.
    await page.mouse.click(middle.x, middle.y, { button: "right" })

    await expect(composerTitle(page)).toBeInViewport()
    await expect(
      page.getByRole("button", { name: "dropped pin" })
    ).toBeVisible()
    expect(Number(lookups[0].searchParams.get("lat"))).toBeCloseTo(
      BERLIN_COORDS.lat,
      4
    )
  })
})
