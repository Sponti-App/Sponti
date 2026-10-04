import { expect, test } from "@playwright/test"
import { makeStubFlare, stubBackend } from "./support/stubs"

// #423: the stubs answer GET /events/:id like the api does. A known id gets
// its event, an unknown one gets a 404 (EVENT_NOT_FOUND) instead of a list.

test("a known flare id opens the flare", async ({ page }) => {
  await stubBackend(page, {
    events: [makeStubFlare({ _id: "event-known", title: "drinks after work" })],
  })
  await page.goto("/event/event-known")

  await expect(page.getByText("drinks after work").first()).toBeVisible()
  await expect(page.getByText("flare not found")).toHaveCount(0)
})

test("an unknown flare id shows flare not found", async ({ page }) => {
  await stubBackend(page, {
    events: [makeStubFlare({ _id: "event-known" })],
  })
  await page.goto("/event/event-missing")

  await expect(page.getByText("flare not found")).toBeVisible()
  // The api's error message, not a parse failure on a list-shaped body.
  await expect(page.getByText("Event not found")).toBeVisible()
})
