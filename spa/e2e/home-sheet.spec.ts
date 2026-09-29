import { expect, test } from "@playwright/test"
import { makeStubFlare, stubBackend } from "./support/stubs"

// #223: the home map's "flares near you" sheet should sit flush on the
// bottom nav at its default "peek" snap — no gap showing map behind it, and
// without covering the nav. Chromium in a normal viewport doesn't reproduce
// the Safari-fullscreen-toolbar trigger #223 was actually filed against
// (that's a WebKit safe-area/viewport quirk), but the underlying geometry
// contract — sheet bottom flush with nav top, nav still hit-testable — is
// the same one #109 asked this suite to guard.
test.describe("home map sheet geometry (#223)", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page, { mapEvents: [makeStubFlare()] })
    await page.goto("/")
    await expect(
      page.getByRole("navigation", { name: "Primary" })
    ).toBeVisible()
  })

  test("the flares sheet sits flush above the bottom nav with no gap and doesn't cover it", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Primary" })
    await expect(page.getByRole("heading", { name: "flares near you" })).toBeVisible()

    // `bg-background` (not `bg-card`, which the flare-composer sheet uses)
    // keeps this locator from ever matching the compose drawer's card.
    const sheet = page.locator("div.rounded-t-3xl.bg-background")
    await expect(sheet).toBeVisible()

    const viewportSize = page.viewportSize()
    const [navBox, sheetBox] = await Promise.all([
      nav.boundingBox(),
      sheet.boundingBox(),
    ])
    if (!navBox || !sheetBox || !viewportSize) {
      throw new Error(
        "expected the nav, the sheet, and the viewport to all have a layout box"
      )
    }

    // No gap: at peek the sheet is anchored flush to the true bottom of the
    // screen (`bottom: 0` in map-view.tsx's sheetStyle) and sits *behind*
    // the nav (which wins the z-index and renders on top over the portion
    // they share) rather than stopping short and leaving a strip of map
    // visible above the nav. A regression that swapped the peek sheet's
    // offset back to something nav-height-aware (the mini-state pattern)
    // would open exactly that gap and fail this.
    expect(
      Math.abs(sheetBox.y + sheetBox.height - viewportSize.height)
    ).toBeLessThanOrEqual(1)

    // Doesn't cover it: the nav is still the hit target at its own center,
    // not occluded by the sheet sitting on top of it.
    const navCenter = {
      x: navBox.x + navBox.width / 2,
      y: navBox.y + navBox.height / 2,
    }
    const navIsOnTop = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y)
        return el?.closest('nav[aria-label="Primary"]') != null
      },
      navCenter
    )
    expect(navIsOnTop).toBe(true)
  })
})
