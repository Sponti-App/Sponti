import { expect, test, type Page } from "@playwright/test"
import { stubJoinNotifications } from "../support/join-notifications"
import { makeStubFlare, stubBackend } from "../support/stubs"

// #380 with `joinMoment` (the full profile): the first join on one of your
// flares pops the friend's avatar up with "mia joined your flare" and arcs it
// into the nav's bell, which swings as the badge pops. Later joins only swing
// the bell. Joins in one poll stack; polls queue. Reduced motion fades.

const moment = (page: Page) => page.locator("[data-join-moment]")
const unread = (page: Page, n: number) =>
  page.locator('[data-nav-tab="feed"]').getByLabel(`${n} unread`)
const bellCue = (page: Page) =>
  page.locator('[data-nav-tab="feed"] [data-bell-cue]')
const MINE = makeStubFlare({
  _id: "0123456789abcdef01234567",
  hostId: "user-e2e-1",
  title: "drinks at the canal",
})

async function home(page: Page) {
  await stubBackend(page, { hostedFlares: [MINE], mapEvents: [MINE] })
  const joins = await stubJoinNotifications(page)
  await page.goto("/")
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible()
  await joins.loaded()
  return joins
}

test.describe("first-join moment (#380)", () => {
  test.setTimeout(60_000)

  test("the first join plays once; a later join only swings the bell", async ({
    page,
  }) => {
    const joins = await home(page)
    joins.arrive([{ id: "n1", actor: "mia", firstJoin: true }])
    await joins.poll()

    await expect(moment(page)).toHaveAttribute("data-join-moment", "arc")
    await expect(page.getByRole("status")).toHaveText("mia joined your flare")
    await expect(moment(page).getByText("drinks at the canal")).toBeVisible()
    // It lands: the bell swings and the badge shows.
    await expect(bellCue(page)).toHaveAttribute("data-bell-cue", "swing")
    await expect(unread(page, 1)).toBeVisible()
    await expect(moment(page)).toHaveCount(0)

    joins.arrive([{ id: "n2", actor: "jonas" }])
    await joins.poll()
    await expect(bellCue(page)).toHaveAttribute("data-bell-cue", "swing")
    await expect(unread(page, 2)).toBeVisible()
    await expect(moment(page)).toHaveCount(0)
  })

  test("joins in one poll stack into one overlay", async ({ page }) => {
    const joins = await home(page)
    joins.arrive([
      { id: "n1", actor: "mia", firstJoin: true },
      { id: "n2", actor: "jonas" },
    ])
    await joins.poll()
    await expect(page.getByRole("status")).toHaveText(
      "mia and jonas joined your flare"
    )
  })

  test("joins in separate polls queue", async ({ page }) => {
    const joins = await home(page)
    joins.arrive([{ id: "n1", actor: "mia", firstJoin: true }])
    await joins.poll()
    await expect(page.getByRole("status")).toHaveText("mia joined your flare")
    joins.arrive([
      { id: "n2", actor: "leo", firstJoin: true, eventTitle: "chess" },
    ])
    await joins.poll()
    // Never two at once: leo waits for mia to land.
    await expect(moment(page)).toHaveCount(1)
    await expect(page.getByRole("status")).toHaveText("leo joined your flare")
    await expect(moment(page)).toHaveCount(1)
  })

  test("plays over the flare drawer and the calendar", async ({ page }) => {
    const joins = await home(page)
    await page
      .getByRole("region", { name: "flares near you" })
      .getByText("drinks at the canal")
      .click()
    await expect(
      page.locator(`[data-flare-drawer="${MINE._id}"]`)
    ).toBeVisible()
    joins.arrive([{ id: "n1", actor: "mia", firstJoin: true }])
    await joins.poll()
    await expect(moment(page)).toBeVisible()
    await expect(bellCue(page)).toHaveAttribute("data-bell-cue", "swing")

    await expect(moment(page)).toHaveCount(0)
    // Home again closes the drawer; then the calendar ("soon").
    // By its tab: the open drawer hides the nav from the a11y tree (#628).
    await page.locator('[data-nav-tab="home"]').click()
    await page.getByRole("button", { name: "soon", exact: true }).click()
    joins.arrive([{ id: "n2", actor: "leo", firstJoin: true }])
    await joins.poll()
    await expect(page.getByRole("status")).toHaveText("leo joined your flare")
  })

  test("a leave plays nothing", async ({ page }) => {
    const joins = await home(page)
    joins.arrive([{ id: "n1", actor: "mia", change: "declined" }])
    await joins.poll()
    await expect(unread(page, 1)).toBeVisible()
    await expect(moment(page)).toHaveCount(0)
    await expect(bellCue(page)).toHaveCount(0)
  })

  test("with reduced motion it fades in place and lights the bell", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    const joins = await home(page)
    joins.arrive([{ id: "n1", actor: "mia", firstJoin: true }])
    await joins.poll()
    await expect(moment(page)).toHaveAttribute("data-join-moment", "reduced")
    await expect(bellCue(page)).toHaveAttribute("data-bell-cue", "highlight")
    await expect(unread(page, 1)).toBeVisible()
  })
})
