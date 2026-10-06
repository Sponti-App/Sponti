import { expect, test } from "@playwright/test"
import { makeStubFlare, stubBackend } from "./support/stubs"

// #399: the stubs answer POST /maps/route with a fixed walking route, so the
// flare page shows its walk time and the app logs no failed route.

test("the flare page shows the walk time from the stubbed route", async ({
  page,
}) => {
  const warnings: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "warning") warnings.push(msg.text())
  })
  await stubBackend(page, {
    events: [makeStubFlare({ _id: "event-route", title: "drinks after work" })],
  })
  await page.goto("/event/event-route")

  await expect(page.getByRole("link", { name: /open in maps/ })).toContainText(
    "10 min walk"
  )
  expect(warnings.filter((w) => w.includes("route failed"))).toEqual([])
})
