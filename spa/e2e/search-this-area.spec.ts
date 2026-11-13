import { expect, test, type Page } from "@playwright/test"
import {
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "./support/stubs"

// #642: after the map is panned far from the ideas' centre, "search this area"
// shows and picks the idea spots around the map's centre. With no maps key the
// map is the flat stand-in, whose backdrop pans a virtual camera at 4 m per
// pixel, so a 400 px drag is 1.6 km.
const JUNE = "2026-06-15T12:00:00.000Z"

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const search = (page: Page) =>
  page.getByRole("button", { name: "search this area" })
const pins = (page: Page) => page.locator("[data-idea-pin]")

// Two flares of other types far north (#522: the chips need two flares), so
// the map is not quiet but has nothing near the idea spots.
function otherFlares(): StubApiEvent[] {
  const now = new Date(JUNE).getTime()
  const north = {
    type: "Point" as const,
    coordinates: [BERLIN_COORDS.lng, BERLIN_COORDS.lat + 0.014] as [
      number,
      number,
    ],
  }
  return (["party", "culture"] as const).map((type) =>
    makeStubFlare({
      _id: `e-${type}`,
      title: `${type} up north`,
      type,
      startAt: new Date(now - 10 * 60_000).toISOString(),
      endAt: new Date(now + 90 * 60_000).toISOString(),
      location: north,
    })
  )
}

/** Drags the map backdrop from `from` by (dx, dy) screen pixels. */
async function pan(page: Page, dx: number, dy: number) {
  const from = { x: 200, y: 300 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2)
  await page.mouse.move(from.x + dx, from.y + dy)
  await page.mouse.up()
}

async function ideaIds(page: Page) {
  return (await pins(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-idea-pin"))
  )) as string[]
}

test.describe("search this area (#642)", () => {
  test("a pan shows the button; tapping it picks the spots around the map centre", async ({
    page,
  }) => {
    await page.clock.setFixedTime(JUNE)
    await stubBackend(page, { mapEvents: otherFlares(), coords: BERLIN_COORDS })
    await page.goto("/")
    await expect(nav(page)).toBeVisible()
    await expect(pins(page).first()).toBeVisible()
    const around = await ideaIds(page)
    const floating = await page.locator("[data-floating-idea]").count()

    // A nudge is not enough.
    await pan(page, 0, 100)
    await expect(search(page)).toHaveCount(0)

    await pan(page, 0, -300)
    await pan(page, 0, -300)
    await pan(page, 0, -300)
    await expect(search(page)).toBeVisible()
    // Nothing changes until the button is tapped.
    expect(await ideaIds(page)).toEqual(around)

    await search(page).click()
    await expect(search(page)).toHaveCount(0)
    const there = await ideaIds(page)
    expect(there).toHaveLength(5)
    expect(there).toContain("reichstag-dome")
    expect(there).not.toContain("humboldthain-rose-garden")
    // The ideas "on you" stay on the person.
    await expect(page.locator("[data-floating-idea]")).toHaveCount(floating)

    // Recentering on myself (here: panning back) switches back to "me".
    await pan(page, 0, 300)
    await pan(page, 0, 300)
    await pan(page, 0, 300)
    await expect(search(page)).toHaveCount(0)
    await expect.poll(() => ideaIds(page)).toEqual(around)
  })
})
