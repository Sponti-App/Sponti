import { expect, test, type Page } from "@playwright/test"
import { makeStubFlare, stubBackend } from "./support/stubs"

// #419, then #615: the flare detail is a drawer over the home map that runs
// under the bottom nav, so the nav (and the bell, for the first-join moment,
// #380) stays in view and tappable at every height. Geometry is asserted in
// numbers since what matters is where things sit, not how they look.

const inMinutes = (min: number) =>
  new Date(Date.now() + min * 60_000).toISOString()

const FLARE = makeStubFlare({
  _id: "event-above-nav",
  title: "drinks after work",
  startAt: inMinutes(-10),
  endAt: inMinutes(90),
})

const primaryNav = (page: Page) => page.locator('nav[aria-label="Primary"]')
const navButton = (page: Page, label: string) =>
  primaryNav(page).locator("button", { hasText: label })

async function openDetailSheet(page: Page) {
  await stubBackend(page, { mapEvents: [FLARE] })
  await page.goto("/")
  const nav = primaryNav(page)
  await expect(nav).toBeVisible()
  await page
    .getByRole("region", { name: "flares near you" })
    .getByText("drinks after work")
    .click()
  const sheet = page.getByRole("dialog", { name: "drinks after work" })
  await expect(sheet).toBeVisible()
  // vaul slides the sheet in; wait until it has stopped moving.
  let last = -1
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox()
      const settled = box?.y === last
      last = box?.y ?? -1
      return settled
    })
    .toBe(true)
  return { nav, sheet }
}

test.describe("flare drawer and the nav (#419, #615)", () => {
  test("runs under the nav, which stays on top and tappable", async ({
    page,
  }) => {
    const { nav, sheet } = await openDetailSheet(page)

    const [navBox, sheetBox] = await Promise.all([
      nav.boundingBox(),
      sheet.boundingBox(),
    ])
    if (!navBox || !sheetBox) throw new Error("expected boxes")
    // The drawer reaches the bottom of the screen, behind the nav.
    expect(sheetBox.y + sheetBox.height).toBeGreaterThan(navBox.y)

    // What is hit inside the nav must be the nav, not the drawer behind it.
    const hitsNav = await nav.evaluate(
      (el, box) =>
        [box.y + 4, box.y + box.height / 2].every((y) => {
          const hit = document.elementFromPoint(box.x + box.width / 2, y)
          return hit ? el.contains(hit) : false
        }),
      navBox
    )
    expect(hitsNav).toBe(true)

    // The bell is in view while the drawer is open.
    await expect(navButton(page, "feed")).toBeVisible()
  })

  test("slides away behind the nav's top edge when it closes, never across the nav", async ({
    page,
  }) => {
    const { nav } = await openDetailSheet(page)
    const navBox = await nav.boundingBox()
    if (!navBox) throw new Error("expected nav box")

    // Sample every frame of the close animation: a point just inside the
    // nav's top edge must never land on the sliding sheet.
    const sampling = page.evaluate(
      ({ x, y }) =>
        new Promise<number>((resolve) => {
          let sheetFrames = 0
          const started = performance.now()
          const tick = () => {
            const hit = document.elementFromPoint(x, y)
            if (hit?.closest("[data-vaul-drawer]")) sheetFrames++
            if (performance.now() - started < 800) requestAnimationFrame(tick)
            else resolve(sheetFrames)
          }
          requestAnimationFrame(tick)
        }),
      { x: navBox.x + navBox.width / 2, y: navBox.y + 4 }
    )
    await page.keyboard.press("Escape")
    expect(await sampling).toBe(0)
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("tapping the bell closes the drawer and opens the feed", async ({
    page,
  }) => {
    const { sheet } = await openDetailSheet(page)

    await navButton(page, "feed").click()

    await expect(
      page.getByRole("dialog", { name: "notifications" })
    ).toBeVisible()
    await expect(sheet).toBeHidden()
  })

  test("tapping a nav tab closes the drawer and goes there in one tap", async ({
    page,
  }) => {
    const { sheet } = await openDetailSheet(page)

    await navButton(page, "circles").click()

    await expect(page).toHaveURL(/\/circles/, { timeout: 20_000 })
    await expect(sheet).toBeHidden()
  })

  test("tapping home while already home closes the drawer", async ({
    page,
  }) => {
    const { sheet } = await openDetailSheet(page)
    // `next dev` floats its dev-tools badge over the bottom-left corner, which
    // is where the home tab sits. It isn't in a real build.
    await page.addStyleTag({ content: "nextjs-portal { display: none; }" })

    await navButton(page, "home").click()

    await expect(sheet).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
  })
})
