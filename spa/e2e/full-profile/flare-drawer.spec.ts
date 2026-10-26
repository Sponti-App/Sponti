import { expect, test, type Page } from "@playwright/test"
import { makeStubFlare, STUB_USER, stubBackend } from "../support/stubs"

// #615: one flare detail, a drawer over the home map (the full profile has
// `flareDrawer` on). The map's rail and pins open it, `/event/<id>` opens it
// too, closing goes back to where the person came from, and directions are
// a choice rather than a jump to google maps.

const inMinutes = (min: number) =>
  new Date(Date.now() + min * 60_000).toISOString()

const FLARE = makeStubFlare({
  _id: "0123456789abcdef01234567",
  title: "drinks after work",
  startAt: inMinutes(-10),
  endAt: inMinutes(90),
})

const drawer = (page: Page) =>
  page.locator(`[data-flare-drawer="${FLARE._id}"]`)
const primaryNav = (page: Page) => page.locator('nav[aria-label="Primary"]')
// The drawer's visible title (vaul also renders a screen-reader one).
const title = (page: Page) =>
  drawer(page).locator("h2:not(.sr-only)", { hasText: "drinks after work" })

const actionBar = (page: Page) => page.locator("[data-flare-action-bar]")

async function openFromRail(page: Page) {
  await stubBackend(page, { mapEvents: [FLARE] })
  await page.goto("/")
  await page
    .getByRole("region", { name: "flares near you" })
    .getByText("drinks after work")
    .click()
  await expect(drawer(page)).toBeVisible()
  await expect(title(page)).toBeVisible()
}

test.describe("flare drawer (#615)", () => {
  // The first visit compiles the home map and the drawer in dev.
  test.slow()

  test("opens over the map from the rail, under a nav that stays tappable", async ({
    page,
  }) => {
    await openFromRail(page)
    await expect(drawer(page)).toHaveAttribute("data-snap", "half")
    // The map's dock steps aside while the drawer is open.
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeHidden()

    const navBox = await primaryNav(page).boundingBox()
    if (!navBox) throw new Error("expected the nav")
    const hitsNav = await primaryNav(page).evaluate((el, box) => {
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2
      )
      return hit ? el.contains(hit) : false
    }, navBox)
    expect(hitsNav).toBe(true)
  })

  test("closes back to the map, and the url stays the home map", async ({
    page,
  }) => {
    await openFromRail(page)
    await drawer(page).getByRole("button", { name: "close" }).click()
    await expect(drawer(page)).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole("region", { name: "flares near you" })
    ).toBeVisible()
  })

  test("directions offer the in-app route or google maps, never a direct jump", async ({
    page,
  }) => {
    await openFromRail(page)
    const maps = drawer(page).getByRole("link", { name: /google maps/ })
    await expect(maps).toBeHidden()
    await drawer(page)
      .getByRole("button", { name: /directions/ })
      .click()
    await expect(maps).toBeVisible()
    await expect(maps).toHaveAttribute("target", "_blank")
    await expect(
      drawer(page).getByRole("button", { name: "see route" })
    ).toBeVisible()
  })

  test("/event/<id> opens the drawer on the home map; closing a cold link stays home", async ({
    page,
  }) => {
    await stubBackend(page, { mapEvents: [FLARE] })
    await page.goto(`/event/${FLARE._id}`)
    await expect(page).toHaveURL(new RegExp(`/\\?flare=${FLARE._id}$`))
    await expect(drawer(page)).toBeVisible()
    await expect(title(page)).toBeVisible()

    await drawer(page).getByRole("button", { name: "close" }).click()
    await expect(drawer(page)).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
  })

  test("an updates link opens the drawer at full on the updates tab", async ({
    page,
  }) => {
    await stubBackend(page, { mapEvents: [FLARE] })
    await page.goto(`/event/${FLARE._id}?tab=updates`)
    await expect(page).toHaveURL(
      new RegExp(`/\\?flare=${FLARE._id}&tab=updates$`)
    )
    await expect(drawer(page)).toHaveAttribute("data-snap", "full")
    await expect(
      drawer(page).getByRole("tab", { name: /updates/, selected: true })
    ).toBeVisible()
  })

  test("the main action stays pinned above the nav as the drawer changes height", async ({
    page,
  }) => {
    await openFromRail(page)
    const navTop = async () => (await primaryNav(page).boundingBox())!.y
    const barBottom = async () => {
      const box = (await actionBar(page).boundingBox())!
      return box.y + box.height
    }
    await expect(
      actionBar(page).getByRole("button", { name: /join/ })
    ).toBeVisible()
    expect(Math.abs((await barBottom()) - (await navTop()))).toBeLessThan(2)

    await drawer(page)
      .getByRole("tab", { name: /updates/ })
      .click()
    await expect(drawer(page)).toHaveAttribute("data-snap", "full")
    expect(Math.abs((await barBottom()) - (await navTop()))).toBeLessThan(2)
  })

  test("at full, the end of the drawer scrolls into view above the action bar", async ({
    page,
  }) => {
    await stubBackend(page, { mapEvents: [FLARE] })
    await page.goto(`/event/${FLARE._id}?tab=updates`)
    await expect(drawer(page)).toHaveAttribute("data-snap", "full")
    await expect(actionBar(page)).toBeVisible()
    // Let the drawer finish sliding up.
    await page.waitForTimeout(600)

    const gap = await drawer(page).evaluate((el) => {
      const room = el.querySelector("[data-flare-bar-room]")!
      const scroller = room.parentElement!
      scroller.scrollTop = scroller.scrollHeight
      const last = room.previousElementSibling!.getBoundingClientRect()
      const bar = document
        .querySelector("[data-flare-action-bar]")!
        .getBoundingClientRect()
      return bar.top - last.bottom
    })
    expect(gap).toBeGreaterThanOrEqual(0)
  })

  test("dragging down from a scrolled full drawer brings the header back", async ({
    page,
  }) => {
    // Enough guests that the full drawer scrolls.
    const busy = makeStubFlare({
      ...FLARE,
      goingCount: 30,
      attendees: Array.from({ length: 30 }, (_, n) => ({
        _id: `guest-${n}`,
        displayName: `guest ${n}`,
        username: `guest${n}`,
      })),
    })
    await stubBackend(page, { mapEvents: [busy] })
    await page.goto(`/event/${FLARE._id}?tab=updates`)
    await expect(drawer(page)).toHaveAttribute("data-snap", "full")
    await drawer(page).getByRole("tab", { name: /going/ }).click()
    await page.waitForTimeout(600)
    const scrolled = await drawer(page).evaluate((el) => {
      const scroller = el.querySelector("[data-flare-bar-room]")!.parentElement!
      scroller.scrollTop = scroller.scrollHeight
      return scroller.scrollTop
    })
    expect(scrolled).toBeGreaterThan(100)

    // Drag the drawer down by its top edge, as a finger would.
    const box = (await drawer(page).boundingBox())!
    const x = box.x + box.width / 2
    await page.mouse.move(x, box.y + 8)
    await page.mouse.down()
    await page.mouse.move(x, box.y + 150, { steps: 8 })
    await page.mouse.move(x, box.y + 300, { steps: 8 })
    await page.mouse.up()
    await expect(drawer(page)).not.toHaveAttribute("data-snap", "full")

    await expect
      .poll(() =>
        drawer(page).evaluate(
          (el) =>
            el.querySelector("[data-flare-bar-room]")!.parentElement!.scrollTop
        )
      )
      .toBe(0)
    await expect(title(page)).toBeInViewport()
  })

  test("share an update opens the composer, and it keeps focus", async ({
    page,
  }) => {
    // The composer sits outside the drawer's DOM, where the drawer's focus
    // trap used to pull focus back and close it at once. Focus inside the
    // drawer first (the tab), as iOS always has it there.
    await stubBackend(page, { mapEvents: [{ ...FLARE, myRsvp: "going" }] })
    await page.goto(`/event/${FLARE._id}`)
    await drawer(page)
      .getByRole("tab", { name: /updates/ })
      .click()
    await actionBar(page)
      .getByRole("button", { name: /share an update/ })
      .click()
    const input = actionBar(page).getByRole("textbox", { name: "update" })
    await expect(input).toBeFocused()
    await page.waitForTimeout(300)
    await expect(input).toBeFocused()
    await input.fill("on my way")
    await expect(input).toHaveValue("on my way")
  })

  test("a flare with no set end shows no end, and its host can end it now (#614)", async ({
    page,
  }) => {
    await stubBackend(page, {
      mapEvents: [{ ...FLARE, hostId: STUB_USER.id, endAt: null }],
    })
    const patched = page.waitForRequest(
      (req) =>
        req.method() === "PATCH" &&
        new URL(req.url()).pathname.endsWith(`/events/${FLARE._id}`)
    )
    await page.goto(`/event/${FLARE._id}`)
    await expect(drawer(page).getByText(/^live · since /)).toBeVisible()
    await expect(drawer(page).getByText(/^until /)).toHaveCount(0)

    await drawer(page)
      .getByRole("button", { name: "end now", exact: true })
      .click()
    await drawer(page).getByRole("button", { name: "end now?" }).click()
    const body = (await patched).postDataJSON() as { endAt: string }
    expect(Math.abs(Date.parse(body.endAt) - Date.now())).toBeLessThan(10_000)
  })
})
