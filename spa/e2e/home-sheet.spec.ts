import { expect, test, type Locator, type Page } from "@playwright/test"
import {
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "./support/stubs"

// #223: the home map's "flares near you" drawer is a dock (filter bar, plus
// the FAB at peek or a card rail at mid) and a full-height list page, all
// fixed to bottom: var(--sponti-nav-h). These guard the geometry contract
// #109 asked for: whatever the map docks sits flush on the nav, never covers
// it, and the document itself never scrolls. Chromium doesn't reproduce
// Safari collapsing its toolbars, so one test forces what Safari does then
// (a 34px bottom safe-area inset) with a style tag, as the #234 prototype did.

const MIN = 60_000

function flares() {
  const now = Date.now()
  return [
    makeStubFlare({
      _id: "event-live-drinks",
      title: "drinks after work",
      type: "drinks",
    }),
    makeStubFlare({
      _id: "event-live-sports",
      title: "sunset frisbee",
      type: "sports",
      goingCount: 0,
    }),
    makeStubFlare({
      _id: "event-soon-culture",
      title: "gallery late opening",
      type: "culture",
      startAt: new Date(now + 40 * MIN).toISOString(),
      endAt: new Date(now + 160 * MIN).toISOString(),
    }),
  ]
}

type Box = { x: number; y: number; width: number; height: number }

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox()
  if (!b) throw new Error("expected the element to have a layout box")
  return b
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const dock = (page: Page) => page.locator("[data-map-dock]")
const rail = (page: Page) =>
  page.getByRole("region", { name: "flares near you" })
const navFlare = (page: Page) =>
  page.getByRole("button", { name: "flare", exact: true })

/** The nav is the hit target at its own centre, i.e. nothing covers it. */
async function navIsOnTop(page: Page): Promise<boolean> {
  const b = await box(nav(page))
  return page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('nav[aria-label="Primary"]') !=
      null,
    { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  )
}

/** Bottom edge of `locator` minus the nav's top edge (0 = flush). */
async function gapAboveNav(page: Page, locator: Locator): Promise<number> {
  const [n, b] = await Promise.all([box(nav(page)), box(locator)])
  return n.y - (b.y + b.height)
}

test.describe("home map dock geometry (#223)", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page, { mapEvents: flares() })
    await page.goto("/")
    await expect(nav(page)).toBeVisible()
    await expect(rail(page).getByText("drinks after work")).toBeVisible()
  })

  test("opens at mid: the card rail sits in a dock flush on the nav, and the nav stays on top", async ({
    page,
  }) => {
    expect(Math.abs(await gapAboveNav(page, dock(page)))).toBeLessThanOrEqual(1)
    // The rail is inside the dock, above the filter bar.
    const railBox = await box(rail(page))
    const dockBox = await box(dock(page))
    expect(railBox.y).toBeGreaterThanOrEqual(dockBox.y)
    // FAB only at peek: from mid up the nav's flare button does the same.
    await expect(
      page.getByRole("button", { name: "Light a flare", exact: true })
    ).toBeHidden()
    expect(await navIsOnTop(page)).toBe(true)
  })

  test("peek: the filter bar and FAB stay flush on the nav without the rail", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "hide cards" }).click()
    await expect(rail(page)).toBeHidden()
    await expect(
      page.getByRole("button", { name: "Light a flare", exact: true })
    ).toBeVisible()
    expect(Math.abs(await gapAboveNav(page, dock(page)))).toBeLessThanOrEqual(1)
    expect(await navIsOnTop(page)).toBe(true)

    await page.getByRole("button", { name: "show cards" }).click()
    await expect(rail(page)).toBeVisible()
  })

  test("full: the list page runs from under the header chips down to the nav, without covering either", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "list", exact: true }).click()
    const list = page.getByRole("region", { name: "flare list" })
    await expect(
      list.getByRole("heading", { name: "flares near you" })
    ).toBeVisible()
    await expect(dock(page)).toBeHidden()

    // The page slides in (500ms); measure once it has settled.
    await expect
      .poll(async () => Math.abs(await gapAboveNav(page, list)))
      .toBeLessThanOrEqual(1)
    const [listBox, settingsBox] = await Promise.all([
      box(list),
      box(page.getByRole("button", { name: "Settings" })),
    ])
    expect(listBox.y).toBeGreaterThanOrEqual(settingsBox.y + settingsBox.height)
    expect(await navIsOnTop(page)).toBe(true)
    await expect(list.getByText("gallery late opening")).toBeVisible()

    await list.getByRole("button", { name: "map", exact: true }).click()
    await expect(rail(page)).toBeVisible()
    await expect(list).toBeHidden()
  })

  test("rail cards are content-height, not stretched to a taller neighbour", async ({
    page,
  }) => {
    const cards = rail(page).locator("[data-rail-id]")
    await expect(cards).toHaveCount(3)
    for (const card of await cards.all()) {
      const emptyBelowContent = await card.evaluate((el) => {
        const last = el.lastElementChild as HTMLElement
        return (
          el.getBoundingClientRect().bottom -
          last.getBoundingClientRect().bottom
        )
      })
      // p-3 plus the 1px border: anything more is stretched empty space.
      expect(emptyBelowContent).toBeLessThanOrEqual(13.5)
    }
  })

  test("a rail with flares ends on the last flare, with no start-one card (#331)", async ({
    page,
  }) => {
    const items = rail(page).locator(":scope > *")
    await expect(items).toHaveCount(3)
    await expect(items.last()).toHaveAttribute(
      "data-rail-id",
      "event-soon-culture"
    )
    await expect(rail(page).getByText("nothing you fancy?")).toHaveCount(0)
    await expect(
      rail(page).getByText("start one and your circles will see it")
    ).toHaveCount(0)
    await expect(
      rail(page).getByRole("button", { name: "light a flare" })
    ).toHaveCount(0)
  })

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the nav's flare button is a peach circle that stays inside the nav (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme })
      await page.reload()
      await expect(nav(page)).toBeVisible()
      const circle = navFlare(page).locator("[data-nav-flare-circle]")
      const [navBox, circleBox] = await Promise.all([
        box(nav(page)),
        box(circle),
      ])
      // The ring (ring-2 + ring-offset-2) reaches 4px past the circle.
      expect(circleBox.y - 4).toBeGreaterThanOrEqual(navBox.y)
      expect(circleBox.y + circleBox.height + 4).toBeLessThanOrEqual(
        navBox.y + navBox.height
      )
      const [fill, accent] = await circle.evaluate((el) => {
        const probe = document.createElement("div")
        probe.style.background = "var(--accent)"
        document.body.appendChild(probe)
        const accent = getComputedStyle(probe).backgroundColor
        probe.remove()
        return [getComputedStyle(el).backgroundColor, accent]
      })
      expect(fill).toBe(accent)
    })
  }

  test("simulated Safari fullscreen: --sponti-nav-h follows the nav's grown padding, the dock stays flush, and the page can't scroll", async ({
    page,
  }) => {
    const navBefore = await box(nav(page))
    // What Safari does when its toolbars collapse: the bottom safe-area
    // inset goes from 0 to 34px. env() can't be overridden, so force the
    // two paddings that read it.
    await page.addStyleTag({
      content: `
        nav[aria-label="Primary"] { padding-bottom: 34px !important; }
        body { padding-bottom: 34px !important; }
      `,
    })
    await expect
      .poll(async () => (await box(nav(page))).height)
      .toBeGreaterThan(navBefore.height + 20)

    // The nav's ResizeObserver writes the variable on the next frame. With
    // the default content-box observer it never would: only padding changed.
    const grownNavH = `${Math.round((await box(nav(page))).height)}px`
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--sponti-nav-h")
            .trim()
        )
      )
      .toBe(grownNavH)
    await expect
      .poll(async () => Math.abs(await gapAboveNav(page, dock(page))))
      .toBeLessThanOrEqual(1)

    // Nothing to scroll, so Safari has nothing to lift the page with.
    const scroll = await page.evaluate(() => {
      window.scrollTo(0, 1000)
      return {
        scrollY: window.scrollY,
        overflow: document.documentElement.scrollHeight - window.innerHeight,
      }
    })
    expect(scroll.scrollY).toBe(0)
    expect(scroll.overflow).toBeLessThanOrEqual(0)
  })
})

test.describe("quiet state: one type selected, nothing of it live (#223)", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page, { mapEvents: flares() })
    await page.goto("/")
    await expect(nav(page)).toBeVisible()
    await expect(rail(page).getByText("drinks after work")).toBeVisible()
  })

  const quietCard = (page: Page) => page.locator("[data-quiet-card]")
  const chip = (page: Page, name: string) =>
    dock(page).getByRole("button", { name, exact: true })

  test("shows the type card and the nav's type icon, and reverts on a second chip or deselecting", async ({
    page,
  }) => {
    await expect(navFlare(page).locator("svg[data-icon='flame']")).toBeVisible()

    await chip(page, "food").click()
    await expect(quietCard(page)).toBeVisible()
    await expect(quietCard(page).getByText("up for food?")).toBeVisible()
    await expect(
      quietCard(page).getByRole("button", { name: "light a food flare" })
    ).toBeVisible()
    await expect(rail(page)).toBeHidden()
    await expect(
      navFlare(page).locator("svg[data-icon='fork-knife']")
    ).toBeVisible()
    // The card floats above the dock's filter bar, inside the dock.
    expect(Math.abs(await gapAboveNav(page, dock(page)))).toBeLessThanOrEqual(1)

    // A second chip: no longer exactly one type.
    await chip(page, "party").click()
    await expect(quietCard(page)).toBeHidden()
    await expect(navFlare(page).locator("svg[data-icon='flame']")).toBeVisible()

    await chip(page, "party").click()
    await expect(quietCard(page).getByText("up for food?")).toBeVisible()

    // Deselecting the chip.
    await chip(page, "food").click()
    await expect(quietCard(page)).toBeHidden()
    await expect(rail(page)).toBeVisible()
    await expect(navFlare(page).locator("svg[data-icon='flame']")).toBeVisible()
  })

  test("a live flare of the selected type keeps the rail and the plain nav icon", async ({
    page,
  }) => {
    await chip(page, "drinks").click()
    await expect(rail(page).getByText("drinks after work")).toBeVisible()
    await expect(rail(page).getByText("up for drinks?")).toHaveCount(0)
    await expect(quietCard(page)).toBeHidden()
    await expect(navFlare(page).locator("svg[data-icon='flame']")).toBeVisible()
  })

  test("upcoming flares of the type don't count: nothing is live", async ({
    page,
  }) => {
    await chip(page, "culture").click()
    await expect(quietCard(page).getByText("up for culture?")).toBeVisible()
    await expect(navFlare(page).locator("svg[data-icon='bank']")).toBeVisible()
  })

  test("the card shows at peek too, next to the FAB, and opens the composer", async ({
    page,
  }) => {
    await chip(page, "food").click()
    await page.getByRole("button", { name: "hide cards" }).click()
    await expect(quietCard(page)).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Light a flare", exact: true })
    ).toBeVisible()

    await quietCard(page)
      .getByRole("button", { name: "light a food flare" })
      .click()
    await expect(
      page.getByPlaceholder("what's the plan? e.g. drinks after work")
    ).toBeInViewport()
  })

  test("the nav icon resets when leaving the home map", async ({ page }) => {
    await chip(page, "food").click()
    await expect(
      navFlare(page).locator("svg[data-icon='fork-knife']")
    ).toBeVisible()

    // The calendar view unmounts the map.
    await page.getByRole("button", { name: "calendar" }).click()
    await expect(navFlare(page).locator("svg[data-icon='flame']")).toBeVisible()

    await page.getByRole("button", { name: "map" }).click()
    await chip(page, "food").click()
    await expect(
      navFlare(page).locator("svg[data-icon='fork-knife']")
    ).toBeVisible()

    // Another route.
    await page.getByRole("button", { name: "my flares", exact: true }).click()
    await expect(page).toHaveURL(/\/event$/)
    await expect(navFlare(page).locator("svg[data-icon='flame']")).toBeVisible()
  })
})

// #243: with a berlin position the quiet card is a real idea from the curated
// list (2 km, nearest first), and lighting it opens the composer filled in.
// The idea list has date-dependent seasons (the drinks idea near humboldthain,
// prater-beer-garden, runs 15 Apr to 30 Sep), so the browser clock is fixed to
// a day inside them. Stub flares are stamped from Date.now() in node, which
// would then be a different day from the page's, so they are stamped from the
// same fixed day instead (see flareAt).
const JUNE = "2026-06-15T12:00:00.000Z"

test.describe("quiet state: an idea card near berlin (#243)", () => {
  const quietCard = (page: Page) => page.locator("[data-quiet-card]")
  const chip = (page: Page, name: string) =>
    dock(page).getByRole("button", { name, exact: true })
  const composerTitle = (page: Page) =>
    page.getByPlaceholder("what's the plan? e.g. drinks after work")

  // Stub flares default to san francisco; put them near the berlin user.
  const inBerlin = {
    type: "Point" as const,
    coordinates: [BERLIN_COORDS.lng, BERLIN_COORDS.lat] as [number, number],
  }

  // A live flare on the fixed day, like makeStubFlare's default on the real one.
  const flareAt = (overrides: Partial<StubApiEvent>) => {
    const now = new Date(JUNE).getTime()
    return makeStubFlare({
      startAt: new Date(now - 10 * MIN).toISOString(),
      endAt: new Date(now + 90 * MIN).toISOString(),
      ...overrides,
    })
  }

  const openBerlinMap = async (page: Page, mapEvents: StubApiEvent[]) => {
    await page.clock.setFixedTime(JUNE)
    await stubBackend(page, { mapEvents, coords: BERLIN_COORDS })
    await page.goto("/")
    await expect(nav(page)).toBeVisible()
  }

  test("shows the nearest idea with an idea tag, and its CTA opens the composer with title and place filled", async ({
    page,
  }) => {
    // Nothing of the type is live: the stub flares are sports and culture.
    await openBerlinMap(page, [
      flareAt({
        location: inBerlin,
        _id: "e-sports",
        title: "sunset frisbee",
        type: "sports",
      }),
    ])
    await chip(page, "drinks").click()

    const card = quietCard(page)
    await expect(card).toHaveAttribute("data-quiet-card", "idea")
    await expect(card.getByText("beer garden evening at prater")).toBeVisible()
    await expect(card.getByText(/Prater Biergarten/)).toBeVisible()
    await expect(card.getByText("idea", { exact: true })).toBeVisible()
    await expect(card.getByText("up for drinks?")).toBeHidden()
    await expect(rail(page)).toBeHidden()
    expect(Math.abs(await gapAboveNav(page, dock(page)))).toBeLessThanOrEqual(1)

    await card.getByRole("button", { name: "light a flare" }).click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue(
      "beer garden evening at prater"
    )
    await expect(page.getByText("type · drinks")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Prater Biergarten" })
    ).toBeVisible()
  })

  test("no idea of the type in range: the generic card, opening the composer with the category only", async ({
    page,
  }) => {
    await openBerlinMap(page, [])
    // No curated food spot within 2 km of humboldthain.
    await chip(page, "food").click()

    const card = quietCard(page)
    await expect(card).toHaveAttribute("data-quiet-card", "generic")
    await expect(card.getByText("up for food?")).toBeVisible()
    await card.getByRole("button", { name: "light a food flare" }).click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue("")
    await expect(page.getByText("type · food")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Prater Biergarten" })
    ).toHaveCount(0)
  })

  test("outside berlin the generic card stays", async ({ page }) => {
    await stubBackend(page, { mapEvents: [] })
    await page.goto("/")
    await chip(page, "drinks").click()
    await expect(quietCard(page)).toHaveAttribute("data-quiet-card", "generic")
  })

  test("a live flare of the type takes the card away", async ({ page }) => {
    await openBerlinMap(page, [
      flareAt({
        location: inBerlin,
        _id: "e-drinks",
        title: "drinks after work",
        type: "drinks",
      }),
    ])
    await chip(page, "drinks").click()
    await expect(rail(page).getByText("drinks after work")).toBeVisible()
    await expect(quietCard(page)).toBeHidden()
  })

  test("looks like the rail cards: same width, radius and padding", async ({
    page,
  }) => {
    await openBerlinMap(page, [
      flareAt({
        location: inBerlin,
        _id: "e-sports",
        title: "sunset frisbee",
        type: "sports",
      }),
    ])
    const railCard = rail(page).locator('[data-rail-id="e-sports"]')
    const railStyle = await railCard.evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        radius: cs.borderRadius,
        pad: cs.padding,
        bg: cs.backgroundColor,
      }
    })
    await chip(page, "drinks").click()
    const ideaStyle = await quietCard(page).evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        radius: cs.borderRadius,
        pad: cs.padding,
        bg: cs.backgroundColor,
      }
    })
    expect(ideaStyle).toEqual(railStyle)
  })
})

test.describe("empty rail (#331)", () => {
  test("no flares nearby: the rail shows the empty state with its one call to action", async ({
    page,
  }) => {
    await stubBackend(page, { mapEvents: [] })
    await page.goto("/")
    await expect(nav(page)).toBeVisible()

    await expect(rail(page).getByText(/no flares within \d+ km/)).toBeVisible()
    await expect(
      rail(page).getByRole("button", { name: "connect with your friends" })
    ).toBeVisible()
    await expect(rail(page).locator("[data-rail-id]")).toHaveCount(0)
  })
})
