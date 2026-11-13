import { expect, test, type Page } from "@playwright/test"
import { BERLIN_COORDS, stubBackend } from "./support/stubs"

// #641: "add sponti to your home screen" is offered once after the first
// flare and again from notification settings, only where the browser can add
// it (iPhone Safari steps, Android Chrome install prompt).

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"

const SHEET = "add sponti to your home screen"

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "a phone browser's offer")
})

async function openNotificationSettings(page: Page) {
  await page.goto("/settings")
  await page.getByRole("tab", { name: "Notifications" }).click()
}

async function lightAFlare(page: Page, title: string) {
  const nav = page.getByRole("navigation", { name: "Primary" })
  await nav.getByRole("button", { name: "flare", exact: true }).click()
  await page
    .getByPlaceholder("what's the plan? e.g. drinks after work")
    .fill(title)
  await page.getByRole("button", { name: "light a flare" }).click()
}

test.describe("on iphone safari", () => {
  test.use({ userAgent: IPHONE_SAFARI })

  test("notification settings show the steps and the sign-in line", async ({
    page,
  }) => {
    await stubBackend(page)
    await openNotificationSettings(page)

    await page.getByRole("button", { name: SHEET }).click()
    const sheet = page.getByRole("dialog", { name: SHEET })
    await expect(sheet.getByText("add to home screen")).toBeVisible()
    await expect(sheet.getByText("you'll sign in once more")).toBeVisible()

    await sheet.getByRole("button", { name: "got it" }).click()
    await expect(sheet).toBeHidden()
  })

  test("offers itself once, after the first flare is lit", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"])
    await context.setGeolocation({
      latitude: BERLIN_COORDS.lat,
      longitude: BERLIN_COORDS.lng,
    })
    await stubBackend(page, {
      hostedFlares: [],
      friends: 2,
      circles: [
        { _id: "all", name: "all friends", type: "all", memberCount: 2 },
      ],
    })
    await page.goto("/")
    const sheet = page.getByRole("dialog", { name: SHEET })

    await lightAFlare(page, "park in a bit")
    await expect(sheet).toBeVisible()
    await sheet.getByRole("button", { name: "got it" }).click()
    await expect(sheet).toBeHidden()

    // Remembered on the device: the next flare doesn't ask again.
    await lightAFlare(page, "park again")
    await expect(page.getByText(/light it up/).first()).toBeVisible()
    await page.waitForTimeout(2500)
    await expect(sheet).toHaveCount(0)
  })
})

test.describe("on android chrome", () => {
  test.use({ userAgent: ANDROID_CHROME })

  test("is not offered automatically after a flare, only from settings", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"])
    await context.setGeolocation({
      latitude: BERLIN_COORDS.lat,
      longitude: BERLIN_COORDS.lng,
    })
    await stubBackend(page, {
      hostedFlares: [],
      friends: 2,
      circles: [
        { _id: "all", name: "all friends", type: "all", memberCount: 2 },
      ],
    })
    await page.addInitScript(() => {
      window.addEventListener("load", () => {
        const event = new Event("beforeinstallprompt", { cancelable: true })
        Object.assign(event, {
          prompt: () => Promise.resolve(),
          userChoice: Promise.resolve({ outcome: "dismissed" }),
        })
        window.dispatchEvent(event)
      })
    })
    await page.goto("/")
    await lightAFlare(page, "park in a bit")
    await expect(page.getByText(/light it up/).first()).toBeVisible()
    await page.waitForTimeout(2500)
    await expect(page.getByRole("dialog", { name: SHEET })).toHaveCount(0)
  })

  test("the install button calls the browser's prompt", async ({ page }) => {
    await stubBackend(page)
    await page.addInitScript(() => {
      const w = window as unknown as { __prompted: number }
      w.__prompted = 0
      window.addEventListener("load", () => {
        const event = new Event("beforeinstallprompt", { cancelable: true })
        Object.assign(event, {
          prompt: () => {
            w.__prompted += 1
            return Promise.resolve()
          },
          userChoice: Promise.resolve({ outcome: "accepted" }),
        })
        window.dispatchEvent(event)
      })
    })
    await openNotificationSettings(page)

    await page.getByRole("button", { name: SHEET }).click()
    const sheet = page.getByRole("dialog", { name: SHEET })
    await expect(sheet.getByText("you'll sign in once more")).toHaveCount(0)
    await sheet.getByRole("button", { name: "add to home screen" }).click()

    await expect(sheet).toBeHidden()
    expect(
      await page.evaluate(
        () => (window as unknown as { __prompted: number }).__prompted
      )
    ).toBe(1)
  })
})

test.describe("where it cannot be added", () => {
  test("a plain browser has no entry in notification settings", async ({
    page,
  }) => {
    await stubBackend(page)
    await openNotificationSettings(page)
    await expect(page.getByText("Notify me about")).toBeVisible()
    await expect(page.getByRole("button", { name: SHEET })).toHaveCount(0)
  })

  test.describe("the installed app", () => {
    test.use({ userAgent: IPHONE_SAFARI })

    test("is never offered it", async ({ page }) => {
      await stubBackend(page)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "standalone", { value: true })
      })
      await openNotificationSettings(page)
      await expect(page.getByText("Notify me about")).toBeVisible()
      await expect(page.getByRole("button", { name: SHEET })).toHaveCount(0)
    })
  })
})
