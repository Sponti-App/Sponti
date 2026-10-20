import { expect, test } from "@playwright/test"
import { makeStubFlare, stubBackend } from "./support/stubs"

// #399: the stubs answer POST /maps/route with a fixed walking route, so the
// flare drawer's directions row (#615) shows its walk time and the app logs
// no failed route.

test("the flare shows the walk time from the stubbed route", async ({
  page,
}) => {
  const id = "cccccccccccccccccccccccc"
  const warnings: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "warning") warnings.push(msg.text())
  })
  await stubBackend(page, {
    events: [makeStubFlare({ _id: id, title: "drinks after work" })],
  })
  await page.goto(`/event/${id}`)

  await expect(
    page
      .locator(`[data-flare-drawer="${id}"]`)
      .getByRole("button", { name: /directions/ })
  ).toContainText("10 min walk")
  expect(warnings.filter((w) => w.includes("route failed"))).toEqual([])
})
