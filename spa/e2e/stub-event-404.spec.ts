import { expect, test } from "@playwright/test"
import { makeStubFlare, stubBackend } from "./support/stubs"

// #423: the stubs answer GET /events/:id like the api does. A known id gets
// its event, an unknown one gets a 404 (EVENT_NOT_FOUND) instead of a list.
// `/event/<id>` opens the flare drawer on the home map (#615).

const KNOWN = "aaaaaaaaaaaaaaaaaaaaaaaa"
const drawer = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`[data-flare-drawer="${id}"]`)

test("a known flare id opens the flare", async ({ page }) => {
  await stubBackend(page, {
    events: [makeStubFlare({ _id: KNOWN, title: "drinks after work" })],
  })
  await page.goto(`/event/${KNOWN}`)

  await expect(
    drawer(page, KNOWN).locator("h2:not(.sr-only)", {
      hasText: "drinks after work",
    })
  ).toBeVisible()
  await expect(page.getByText("flare not found")).toHaveCount(0)
})

test("an unknown flare id shows flare not found", async ({ page }) => {
  const missing = "bbbbbbbbbbbbbbbbbbbbbbbb"
  await stubBackend(page, {
    events: [makeStubFlare({ _id: KNOWN })],
  })
  await page.goto(`/event/${missing}`)

  await expect(drawer(page, missing).getByText("flare not found")).toBeVisible()
  // The api's error message, not a parse failure on a list-shaped body.
  await expect(drawer(page, missing).getByText("Event not found")).toBeVisible()
})
