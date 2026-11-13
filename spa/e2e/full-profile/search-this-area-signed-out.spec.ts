import { expect, test, type Page } from "@playwright/test"
import { stubBackend } from "../support/stubs"

// #642 on the signed-out map (`browseBeforeSignup`): the same button, picking
// the idea spots around the map centre. With no maps key the map is the flat
// stand-in, whose backdrop pans a virtual camera at 12 m per pixel here.
test.use({ timezoneId: "Europe/Berlin" })
const JUNE = "2026-06-15T12:00:00.000Z"

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const search = (page: Page) =>
  page.getByRole("button", { name: "search this area" })
const pins = (page: Page) => page.locator("[data-idea-pin]")

async function pan(page: Page, dy: number) {
  await page.mouse.move(330, 130)
  await page.mouse.down()
  await page.mouse.move(330, 130 + dy / 2)
  await page.mouse.move(330, 130 + dy)
  await page.mouse.up()
}

async function ideaIds(page: Page) {
  return (await pins(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-idea-pin"))
  )) as string[]
}

test("a visitor pans, taps search this area and sees that area's spots", async ({
  page,
}) => {
  await page.clock.setFixedTime(JUNE)
  await stubBackend(page, { signedOut: true })
  await page.goto("/")
  await expect(nav(page)).toBeVisible()
  await expect(pins(page).first()).toBeVisible()
  const around = await ideaIds(page)

  await pan(page, 40)
  await expect(search(page)).toHaveCount(0)

  // 300 px is 3.6 km: the camera moves north, towards mitte.
  await pan(page, 300)
  await expect(search(page)).toBeVisible()
  expect(await ideaIds(page)).toEqual(around)

  await search(page).click()
  await expect(search(page)).toHaveCount(0)
  expect(await ideaIds(page)).not.toEqual(around)
})
