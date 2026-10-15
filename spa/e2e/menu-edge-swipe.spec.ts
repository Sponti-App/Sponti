import { expect, test } from "@playwright/test"
import { makeStubFlare, stubBackend } from "./support/stubs"

// #579: the menu opens only from the menu button. A swipe that starts at the
// left edge of the map is a pan, and on iOS Safari that edge is also the
// browser's back gesture.

test.describe("menu edge swipe (#579)", () => {
  test("a swipe right from the left edge over the map does not open the menu", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, "needs touch input")
    await stubBackend(page, {
      mapEvents: [makeStubFlare({ _id: "event-edge", title: "edge test" })],
    })
    await page.goto("/")
    const menuButton = page.locator('[data-coach="menu"]')
    await expect(menuButton).toBeVisible()

    // Real touch events, 10px from the left edge, 200px to the right.
    const y = 300
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      })
    await touch("touchStart", 10)
    for (let x = 30; x <= 210; x += 20) await touch("touchMove", x)
    await touch("touchEnd", 210)

    await expect(menuButton).toHaveAttribute("aria-expanded", "false")

    // The button still opens it.
    await menuButton.click()
    await expect(menuButton).toHaveAttribute("aria-expanded", "true")
    await expect(
      page.getByRole("complementary", { name: "Menu" })
    ).toBeVisible()
  })
})
