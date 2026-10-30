import { expect, test, type Page } from "@playwright/test"
import { API_BASE, BERLIN_COORDS, stubBackend } from "./support/stubs"

// #640: web push in the spa. The stubbed setup can't reach a real push
// service, so this covers the soft ask, the settings switches and a tapped
// push opening the feed; the subscribe itself needs a real phone.

async function lightFlare(page: Page) {
  // Granting only geolocation makes Chromium report notifications as denied,
  // and a denied browser is never asked.
  await page.context().grantPermissions(["geolocation", "notifications"])
  await page.context().setGeolocation({
    latitude: BERLIN_COORDS.lat,
    longitude: BERLIN_COORDS.lng,
  })
  await stubBackend(page, {
    hostedFlares: [],
    friends: 2,
    circles: [{ _id: "all", name: "all friends", type: "all", memberCount: 2 }],
  })
  await page.goto("/")
  const nav = page.getByRole("navigation", { name: "Primary" })
  await nav.getByRole("button", { name: "flare", exact: true }).click()
  await page
    .getByPlaceholder("what's the plan? e.g. drinks after work")
    .fill("park in a bit")
  await page.getByRole("button", { name: "light a flare" }).click()
}

test("after a lit flare, push is offered once", async ({ page }) => {
  await lightFlare(page)
  const ask = page.getByRole("dialog", {
    name: "want to know when someone joins?",
  })
  await expect(ask).toBeVisible()
  await ask.getByRole("button", { name: "not now" }).click()
  await expect(ask).toBeHidden()
  expect(
    await page.evaluate(() => localStorage.getItem("sponti:push-asked"))
  ).toBe("1")
})

test("settings has push on this device and a join switch", async ({ page }) => {
  await stubBackend(page)
  const patches: unknown[] = []
  await page.route(`${API_BASE}/**/notification-settings/me`, async (route) => {
    const base = {
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      eventReminders: true,
      invitationNotifications: true,
      joinNotifications: true,
    }
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>
      patches.push(body)
      await route.fulfill({ json: { data: { ...base, ...body } } })
      return
    }
    await route.fulfill({ json: { data: base } })
  })

  await page.goto("/settings")
  await page.getByRole("tab", { name: "Notifications" }).click()
  await expect(page.locator('[data-push-state="off"]')).toBeVisible()
  await expect(
    page.getByRole("switch", { name: "push on this device" })
  ).toBeEnabled()

  await page.getByRole("switch", { name: "Join notifications" }).click()
  await expect.poll(() => patches).toEqual([{ joinNotifications: false }])
})

test("a tapped push for the feed opens it", async ({ page }) => {
  await stubBackend(page)
  await page.goto("/?notifications=open")
  await expect(
    page.getByRole("dialog", { name: "notifications" })
  ).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})
