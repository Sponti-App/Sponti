import { expect, test, type Page } from "@playwright/test"
import { API_BASE, stubBackend } from "./support/stubs"

// #137: the feed is a bottom sheet like the event detail sheet, docked on the
// nav. Geometry is asserted in numbers (viewport is 375x812 on "mobile") since
// what matters is where it sits and how tall it can get, not how it looks.

function stubNotification(index: number) {
  const createdAt = new Date(Date.now() - index * 5 * 60_000).toISOString()
  return {
    _id: `notification-${index}`,
    userId: "user-e2e-1",
    actorId: "user-e2e-host",
    type: "event_invitation",
    targetType: "event",
    targetId: `event-${index}`,
    title: `maya invited you ${index}`,
    message: `to plans ${index}`,
    readAt: null,
    createdAt,
    updatedAt: createdAt,
    actor: { _id: "user-e2e-host", username: "maya", displayName: "maya" },
  }
}

async function stubFeed(page: Page, count: number) {
  await stubBackend(page)
  // Registered after stubBackend, so it wins for the feed list only.
  await page.route(`${API_BASE}/**/notifications?*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: Array.from({ length: count }, (_, i) => stubNotification(i)),
        pagination: { nextCursor: null },
      }),
    })
  })
}

// The open sheet is modal, so vaul aria-hides everything behind it, the nav
// included. A CSS locator still finds it; a role locator would not.
const primaryNav = (page: Page) => page.locator('nav[aria-label="Primary"]')

async function openFeed(page: Page) {
  await page.goto("/")
  const nav = primaryNav(page)
  await expect(nav).toBeVisible()
  await nav.getByRole("button", { name: "Feed" }).click()
  const sheet = page.getByRole("dialog", { name: "notifications" })
  await expect(sheet).toBeVisible()
  // vaul slides the sheet in; wait until it has stopped moving.
  let last = -1
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox()
      const settled = box?.y === last
      last = box?.y ?? -1
      return settled
    })
    .toBe(true)
  return { nav, sheet }
}

test.describe("notifications sheet (#137)", () => {
  test("docks flush on the bottom nav without covering it, with the sheet styling", async ({
    page,
  }) => {
    await stubFeed(page, 3)
    const { nav, sheet } = await openFeed(page)

    const [navBox, sheetBox] = await Promise.all([
      nav.boundingBox(),
      sheet.boundingBox(),
    ])
    if (!navBox || !sheetBox) throw new Error("expected layout boxes")

    // Sheet bottom edge meets the nav's top edge.
    expect(
      Math.abs(sheetBox.y + sheetBox.height - navBox.y)
    ).toBeLessThanOrEqual(1)

    // The box being flush isn't enough: vaul paints a `::after` that extends
    // the sheet's background 200% below it, which lands on the nav. What is
    // hit at the nav's centre must be the nav, not the sheet or the scrim.
    const hitsNav = await nav.evaluate((el, box) => {
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2
      )
      return hit ? el.contains(hit) : false
    }, navBox)
    expect(hitsNav).toBe(true)

    // Same top radius the other sheets get from `rounded-t-3xl`.
    const [radius, referenceRadius] = await Promise.all([
      sheet.evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
      page.evaluate(() => {
        const probe = document.createElement("div")
        probe.className = "rounded-t-3xl"
        document.body.appendChild(probe)
        const value = getComputedStyle(probe).borderTopLeftRadius
        probe.remove()
        return value
      }),
    ])
    expect(radius).toBe(referenceRadius)
    expect(parseFloat(radius)).toBeGreaterThan(0)
    await expect(
      page.getByRole("heading", { name: "notifications" })
    ).toBeVisible()
    await expect(page.getByText("maya invited you 0")).toBeVisible()
  })

  test("leaves the nav lit and tappable: other items navigate, the feed item closes it", async ({
    page,
  }) => {
    await stubFeed(page, 3)
    const { nav, sheet } = await openFeed(page)

    // The scrim stops above the nav, so the nav isn't dimmed.
    const scrim = page.locator("[data-vaul-overlay]")
    const [scrimBox, navBox] = await Promise.all([
      scrim.boundingBox(),
      nav.boundingBox(),
    ])
    if (!scrimBox || !navBox) throw new Error("expected boxes")
    expect(scrimBox.y + scrimBox.height).toBeLessThanOrEqual(navBox.y + 1)

    // The feed button closes it again.
    await nav.locator("button", { hasText: "feed" }).click()
    await expect(sheet).toBeHidden()

    // Another nav item goes there in one tap, and the sheet is gone.
    await nav.locator("button", { hasText: "feed" }).click()
    await expect(sheet).toBeVisible()
    await nav.locator("button", { hasText: "circles" }).click()
    await expect(page).toHaveURL(/\/circles/)
    await expect(sheet).toBeHidden()
  })

  test("caps its height so the top stays in thumb reach, and scrolls the list inside", async ({
    page,
  }) => {
    await stubFeed(page, 30)
    const { nav, sheet } = await openFeed(page)

    const viewport = page.viewportSize()
    const [navBox, sheetBox] = await Promise.all([
      nav.boundingBox(),
      sheet.boundingBox(),
    ])
    if (!viewport || !navBox || !sheetBox) throw new Error("expected boxes")

    // At least 30% of the screen stays free above the sheet.
    expect(sheetBox.y).toBeGreaterThanOrEqual(viewport.height * 0.3 - 1)

    const list = sheet.getByRole("list")
    const { scrollHeight, clientHeight } = await list.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    expect(scrollHeight).toBeGreaterThan(clientHeight)

    // Scrolling the list moves the list, not the sheet.
    await list.evaluate((el) => el.scrollTo(0, 200))
    const after = await sheet.boundingBox()
    expect(after?.y).toBeCloseTo(sheetBox.y, 0)
  })

  test("closes on an overlay tap, and again from the close button", async ({
    page,
  }) => {
    await stubFeed(page, 3)
    const { sheet } = await openFeed(page)

    await page.mouse.click(180, 40)
    await expect(sheet).toBeHidden()

    await primaryNav(page).getByRole("button", { name: "Feed" }).click()
    await expect(sheet).toBeVisible()
    await page.getByRole("button", { name: "Close notifications" }).click()
    await expect(sheet).toBeHidden()
  })

  // #112: toasts anchor on --sponti-bottom-occupied. Measure where a toast
  // would land with the sheet open and after it closes.
  test("keeps the toast anchor above the open sheet and hands it back on close", async ({
    page,
  }) => {
    await stubFeed(page, 3)
    await page.goto("/")
    await expect(primaryNav(page)).toBeVisible()
    await page.waitForLoadState("networkidle")

    const toastAnchorTop = () =>
      page.evaluate(() => {
        const probe = document.createElement("div")
        probe.style.cssText =
          "position:fixed;left:0;height:0;width:0;bottom:var(--sponti-bottom-occupied,var(--sponti-nav-h,64px))"
        document.body.appendChild(probe)
        const top = probe.getBoundingClientRect().top
        probe.remove()
        return top
      })

    // Something else (on the home page, the map's sheet) already owns the
    // variable; the feed must give it back rather than clear it.
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--sponti-bottom-occupied",
        "300px"
      )
    )
    const before = await toastAnchorTop()

    await primaryNav(page).getByRole("button", { name: "Feed" }).click()
    const sheet = page.getByRole("dialog", { name: "notifications" })
    await expect(sheet).toBeVisible()
    await expect
      .poll(async () =>
        Math.abs(
          (await toastAnchorTop()) - ((await sheet.boundingBox())?.y ?? -99)
        )
      )
      .toBeLessThanOrEqual(1)

    await page.getByRole("button", { name: "Close notifications" }).click()
    await expect(sheet).toBeHidden()
    expect(await toastAnchorTop()).toBe(before)
  })
})
