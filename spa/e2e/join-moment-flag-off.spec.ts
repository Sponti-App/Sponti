import { expect, test } from "@playwright/test"
import { stubJoinNotifications } from "./support/join-notifications"
import { stubBackend } from "./support/stubs"

// #380: `joinMoment` is off in the tester build, so a first join only shows
// the bell's badge, as before.

test("with the flag off a first join only shows the badge", async ({
  page,
}) => {
  await stubBackend(page, {})
  const joins = await stubJoinNotifications(page)
  await page.goto("/")
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible()
  await joins.loaded()

  joins.arrive([{ id: "n1", actor: "mia", firstJoin: true }])
  await joins.poll()
  await expect(
    page.locator('[data-nav-tab="feed"]').getByLabel("1 unread")
  ).toBeVisible()
  await expect(page.locator("[data-join-moment]")).toHaveCount(0)
  await expect(page.locator("[data-bell-cue]")).toHaveCount(0)
})
