import { expect, test } from "@playwright/test"
import { makeStubFlare, STUB_USER, stubBackend } from "./support/stubs"

// #356: the "my flares" tab is lit on the list and on flares you host (page
// and edit page), and no tab is lit on someone else's flare.

const MINE = makeStubFlare({
  _id: "event-mine",
  hostId: STUB_USER.id,
  title: "my own flare",
})
const THEIRS = makeStubFlare({ _id: "event-theirs", title: "their flare" })

const nav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Primary" })
const myFlaresTab = (page: import("@playwright/test").Page) =>
  nav(page).getByRole("button", { name: "my flares" })

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

    await page.goto("/event/event-mine")
    await expect(myFlaresTab(page)).toHaveClass(ACTIVE)

    await page.goto("/event/event-mine/edit")
    await expect(myFlaresTab(page)).toHaveClass(ACTIVE)

    await page.goto("/event/event-theirs")
    await expect(
      page.getByRole("heading", { name: /their flare/i })
    ).toBeVisible()
    await expect(myFlaresTab(page)).not.toHaveClass(ACTIVE)
    await expect(
      nav(page).getByRole("button", { name: "home" })
    ).not.toHaveClass(ACTIVE)
  })
})
