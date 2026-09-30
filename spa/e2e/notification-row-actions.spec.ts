import { expect, test, type Locator, type Page } from "@playwright/test"
import {
  MAYA_ID,
  REQUEST_CONNECTION_ID,
  stubFeedWithRequest,
} from "./support/feed-stubs"

// #173, #174, #226: answering a connection request from the feed, and
// swiping rows. Everything is stubbed (see support/feed-stubs.ts).

async function openFeed(page: Page) {
  await page.goto("/")
  const nav = page.locator('nav[aria-label="Primary"]')
  await expect(nav).toBeVisible()
  await nav.getByRole("button", { name: "Feed" }).click()
  const sheet = page.getByRole("dialog", { name: "notifications" })
  await expect(sheet).toBeVisible()
  // Wait for vaul's slide-in to finish before touching rows.
  let last = -1
  await expect
    .poll(async () => {
      const y = (await sheet.boundingBox())?.y ?? -1
      const settled = y === last
      last = y
      return settled
    })
    .toBe(true)
  return sheet
}

const row = (sheet: Locator, title: string) =>
  sheet.locator("li", { hasText: title })

/** A real touch drag, dispatched through the DevTools protocol. */
async function touchSwipe(page: Page, target: Locator, dx: number, dy = 0) {
  const box = await target.boundingBox()
  if (!box) throw new Error("row not laid out")
  const client = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2
  const y = box.y + Math.min(box.height / 2, 28)
  const point = (px: number, py: number) => [{ x: px, y: py, id: 1 }]

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point(x, y),
  })
  const steps = 8
  for (let i = 1; i <= steps; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(x + (dx * i) / steps, y + (dy * i) / steps),
    })
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await client.detach()
}

test.describe("feed row actions", () => {
  test("accept waits out the undo window, then the chips put them in a circle", async ({
    page,
  }) => {
    const calls = await stubFeedWithRequest(page)
    const sheet = await openFeed(page)
    const request = row(sheet, "maya wants to connect")

    await request.getByRole("button", { name: "accept", exact: true }).click()
    await expect(page.getByText("accepted maya")).toBeVisible()
    const chips = request.getByRole("group", { name: "add maya to a circle" })
    await expect(chips.getByRole("button")).toHaveText([
      "close friends",
      "inner circle",
      "skip",
    ])

    // Picked inside the window: queued, nothing sent yet.
    await chips.getByRole("button", { name: "close friends" }).click()
    await page.waitForTimeout(1_000)
    expect(calls.writes).toEqual([])

    await expect(request.getByText("added to close friends")).toBeVisible({
      timeout: 10_000,
    })
    expect(calls.writes).toEqual([
      `PATCH /connections/${REQUEST_CONNECTION_ID}/respond {"status":"accepted"}`,
      `POST /circles/circle-close/members {"userId":"${MAYA_ID}"}`,
    ])
  })

  test("undo sends nothing", async ({ page }) => {
    const calls = await stubFeedWithRequest(page)
    const sheet = await openFeed(page)
    const request = row(sheet, "maya wants to connect")

    await request.getByRole("button", { name: "accept", exact: true }).click()
    // The open sheet is modal, so vaul aria-hides the app-level toast; find
    // it by CSS. (The row's own "undo accept" is the accessible path.)
    await page.locator("[role=status] button", { hasText: "undo" }).click()
    await expect(
      request.getByRole("button", { name: "accept", exact: true })
    ).toBeVisible()

    await page.waitForTimeout(6_000)
    expect(calls.writes).toEqual([])
  })

  test("closing the sheet during the undo window doesn't lose the accept", async ({
    page,
  }) => {
    const calls = await stubFeedWithRequest(page)
    const sheet = await openFeed(page)

    await row(sheet, "maya wants to connect")
      .getByRole("button", { name: "accept", exact: true })
      .click()
    await page.getByRole("button", { name: "Close notifications" }).click()
    await expect(sheet).toBeHidden()
    expect(calls.writes).toEqual([])

    await expect
      .poll(() => calls.writes, { timeout: 10_000 })
      .toEqual([
        `PATCH /connections/${REQUEST_CONNECTION_ID}/respond {"status":"accepted"}`,
      ])
  })

  test("decline is its own button and updates the row in place", async ({
    page,
  }) => {
    const calls = await stubFeedWithRequest(page)
    const sheet = await openFeed(page)
    const request = row(sheet, "maya wants to connect")

    await request.getByRole("button", { name: "decline" }).click()
    await expect(request.getByText("request declined")).toBeVisible()
    expect(calls.writes).toEqual([
      `PATCH /connections/${REQUEST_CONNECTION_ID}/respond {"status":"rejected"}`,
    ])
  })

  test.describe("on touch", () => {
    test.skip(
      ({ hasTouch }) => !hasTouch,
      "touch gestures only on the mobile project"
    )

    test("swiping left hides a request without declining it", async ({
      page,
    }) => {
      const calls = await stubFeedWithRequest(page)
      const sheet = await openFeed(page)

      await touchSwipe(page, row(sheet, "maya wants to connect"), -220)

      await expect(row(sheet, "maya wants to connect")).toHaveCount(0)
      await expect(row(sheet, "maya invited you")).toBeVisible()
      expect(calls.writes).toEqual([
        "PATCH /notifications/notification-request/dismiss",
      ])
    })

    test("swiping right accepts a request, with the same undo window", async ({
      page,
    }) => {
      const calls = await stubFeedWithRequest(page)
      const sheet = await openFeed(page)
      const request = row(sheet, "maya wants to connect")

      await touchSwipe(page, request, 220)

      await expect(
        request.getByRole("group", { name: "add maya to a circle" })
      ).toBeVisible()
      await expect(page.getByText("accepted maya")).toBeVisible()
      expect(calls.writes).toEqual([])
    })

    test("a short swipe springs back and does nothing", async ({ page }) => {
      const calls = await stubFeedWithRequest(page)
      const sheet = await openFeed(page)
      const invite = row(sheet, "maya invited you")

      await touchSwipe(page, invite, -40)

      await expect(invite).toBeVisible()
      await expect(page).toHaveURL(/\/$/)
      expect(calls.writes).toEqual([])
    })

    test("a vertical drag scrolls instead of swiping", async ({ page }) => {
      const calls = await stubFeedWithRequest(page)
      const sheet = await openFeed(page)
      const invite = row(sheet, "maya invited you")

      await touchSwipe(page, invite, -30, -150)

      await expect(invite).toBeVisible()
      expect(calls.writes).toEqual([])
    })
  })
})
