import { expect, test } from "@playwright/test"
import { STUB_USER, makeStubFlare, stubBackend } from "./support/stubs"

// #580: a flare cancelled on its edit page stayed on the map until the app was
// refocused, because the remounted map reused its 60s cached result. This
// walks the in-app route (no reload), so the module cache is what's tested.

const MINE = makeStubFlare({
  _id: "event-mine",
  hostId: STUB_USER.id,
  title: "my own flare",
})
const OTHER = makeStubFlare({
  _id: "event-other",
  hostId: "user-someone-else",
  title: "someone else's flare",
})

test.describe("cancelling a flare (#580)", () => {
  test("the flare is gone from the map when you go back, without a reload", async ({
    page,
  }) => {
    await stubBackend(page, { mapEvents: [MINE, OTHER] })
    // The api drops a cancelled flare from the map list. Registered after
    // stubBackend, so these answer first and everything else falls through.
    let mapEvents = [MINE, OTHER]
    await page.route(/\/events\/map\/active/, (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mapEvents }),
      })
    })
    await page.route(/\/events\/event-mine\/cancel$/, (route) => {
      mapEvents = mapEvents.filter((e) => e._id !== MINE._id)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ...MINE, status: "cancelled" } }),
      })
    })

    await page.goto("/")
    const rail = page.getByRole("region", { name: "flares near you" })
    await expect(rail.getByText("my own flare")).toBeVisible()
    await expect(rail.getByText("someone else's flare")).toBeVisible()

    // Open it, edit it, cancel it.
    await rail.getByText("my own flare").click()
    await page.getByRole("button", { name: "edit flare" }).click()
    await expect(page).toHaveURL(/\/event\/event-mine\/edit$/)
    await page.getByRole("button", { name: "cancel this flare" }).click()
    await page.getByRole("button", { name: "cancel event" }).click()
    await expect(page).toHaveURL(/\/event$/)

    // Back on the map through the nav: remounted, not reloaded.
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "Home" })
      .click()
    await expect(rail.getByText("someone else's flare")).toBeVisible()
    await expect(rail.getByText("my own flare")).toHaveCount(0)
  })
})
