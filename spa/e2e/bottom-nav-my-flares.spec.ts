import { expect, test } from "@playwright/test"
import { makeStubFlare, STUB_USER, stubBackend } from "./support/stubs"

// #356: the "my flares" tab is lit on the list and on a flare you host's edit
// page. A flare itself opens in the drawer on the home map (#615), so there
// someone else's flare doesn't light "my flares".

const MINE = makeStubFlare({
  _id: "event-mine",
  hostId: STUB_USER.id,
  title: "my own flare",
})
const THEIRS = makeStubFlare({
  _id: "ffffffffffffffffffffffff",
  title: "their flare",
})

// CSS locators: an open flare drawer leaves the nav aria-hidden (vaul makes
// its dialog modal for screen readers, #628), so a role locator wouldn't
// find it.
const nav = (page: import("@playwright/test").Page) =>
  page.locator('nav[aria-label="Primary"]')
const myFlaresTab = (page: import("@playwright/test").Page) =>
  nav(page).locator('button[aria-label="my flares"]')

// The active tab takes the accent colour; the others are muted.
const ACTIVE = /text-accent-ink/

test.describe("bottom nav: my flares (#356)", () => {
  test("lit on the list and on a flare you host, off on someone else's", async ({
    page,
  }) => {
    await stubBackend(page, {
      events: [MINE, THEIRS],
      hostedFlares: [MINE],
    })

    await page.goto("/event")
    await expect(myFlaresTab(page)).toHaveClass(ACTIVE)

    await page.goto("/event/event-mine/edit")
    await expect(myFlaresTab(page)).toHaveClass(ACTIVE)

    await page.goto(`/event/${THEIRS._id}`)
    await expect(
      page
        .locator(`[data-flare-drawer="${THEIRS._id}"]`)
        .locator("h2:not(.sr-only)", { hasText: /their flare/i })
    ).toBeVisible()
    await expect(myFlaresTab(page)).not.toHaveClass(ACTIVE)
  })
})
