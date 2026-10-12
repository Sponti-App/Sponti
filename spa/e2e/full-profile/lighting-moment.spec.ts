import { expect, test, type Page } from "@playwright/test"
import {
  API_BASE,
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "../support/stubs"

// #375/#376 with `flareLightMoment` (the full profile): the nav's flare button
// morphs into the composer's strike strip, a strike lights the flare, and only
// once the api has confirmed it does the lighting moment play: the launch for
// someone's first flare, the wick for every flare after.

const TITLE = "what's the plan? e.g. drinks after work"
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const strip = (page: Page) => page.getByTestId("strike-to-light")
const moment = (page: Page) => page.locator("[data-flare-moment]")
const navCircle = (page: Page) => page.locator("[data-nav-flare-circle]")

/** A flare the account already hosts, so the next one is not its first. */
function hosted(): StubApiEvent {
  return makeStubFlare({
    _id: "event-e2e-mine",
    hostId: "user-e2e-1",
    title: "drinks at the canal",
  })
}

async function openComposer(
  page: Page,
  options: { hostedFlares: StubApiEvent[] }
) {
  await page.context().grantPermissions(["geolocation"])
  await page.context().setGeolocation({
    latitude: BERLIN_COORDS.lat,
    longitude: BERLIN_COORDS.lng,
  })
  await stubBackend(page, { hostedFlares: options.hostedFlares, friends: 2 })
  await page.goto("/")
  await nav(page).getByRole("button", { name: "flare", exact: true }).click()
  await expect(page.getByPlaceholder(TITLE)).toBeInViewport()
  await page.getByPlaceholder(TITLE).fill("park in a bit")
  await expect(strip(page)).toBeEnabled()
}

/** A fast flick along the strip, like striking a match. */
async function strike(page: Page) {
  const box = (await strip(page).boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + 28, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 20, y, { steps: 3 })
  await page.mouse.up()
}

/** Holds POST /events until `release` is called (or fails it). */
async function holdCreate(page: Page) {
  let release: (ok: boolean) => void = () => {}
  const decided = new Promise<boolean>((resolve) => (release = resolve))
  await page.route(`${API_BASE}/api/v1/events`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    if (await decided) return route.fallback()
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INTERNAL", message: "boom" } }),
    })
  })
  return { release }
}

test.describe("lighting moment", () => {
  test("a strike lights the first flare, and the launch plays only after the api confirms", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [] })
    // Registered after stubBackend's routes, so it answers POST /events first.
    const create = await holdCreate(page)

    await strike(page)
    await expect(strip(page)).toContainText("lighting…")
    // Never optimistic: nothing plays while the api hasn't answered.
    await page.waitForTimeout(600)
    await expect(moment(page)).toHaveCount(0)

    create.release(true)
    await expect(moment(page)).toHaveAttribute("data-flare-moment", "launch")
    await expect(page.getByPlaceholder(TITLE)).toBeHidden()
    // The toast follows once the flare has caught, and the moment cleans up.
    await expect(page.getByText(/light it up|lit/).first()).toBeVisible()
    await expect(moment(page)).toHaveCount(0, { timeout: 10_000 })
  })

  test("every flare after the first plays the wick", async ({ page }) => {
    await openComposer(page, { hostedFlares: [hosted()] })
    await strike(page)
    await expect(moment(page)).toHaveAttribute("data-flare-moment", "wick")
    // Nothing of the moment stays over the map.
    await expect(moment(page)).toHaveCount(0, { timeout: 10_000 })
  })

  test("a tap lights it too, as the accessible alternative", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [hosted()] })
    await strip(page).click()
    await expect(moment(page)).toHaveAttribute("data-flare-moment", "wick")
  })

  test("a slow drag fizzles and lights nothing", async ({ page }) => {
    let posts = 0
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url() === `${API_BASE}/api/v1/events`)
        posts++
    })
    await openComposer(page, { hostedFlares: [hosted()] })
    const box = (await strip(page).boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + 28, y)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box.x + 28 + i * 12, y)
      await page.waitForTimeout(80)
    }
    await page.mouse.up()
    await expect(strip(page)).toContainText("swipe faster")
    expect(posts).toBe(0)
    await expect(moment(page)).toHaveCount(0)
  })

  test("an api failure plays no moment and keeps today's error", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [] })
    // Registered after stubBackend's routes, so it answers POST /events first.
    const create = await holdCreate(page)
    await strike(page)
    create.release(false)
    await expect(page.getByText("couldn't light that flare")).toBeVisible()
    await expect(page.getByPlaceholder(TITLE)).toBeInViewport()
    await page.waitForTimeout(800)
    await expect(moment(page)).toHaveCount(0)
    await expect(strip(page)).toContainText(/swipe to light|go live/)
  })

  test("the nav button morphs into the strip and back, and the nav works after", async ({
    page,
  }) => {
    await stubBackend(page, { hostedFlares: [] })
    await page.goto("/")
    await page.evaluate(() => {
      const seen: string[] = []
      ;(window as unknown as { __morphs: string[] }).__morphs = seen
      new MutationObserver((records) => {
        for (const r of records) {
          r.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement && n.dataset.flareMorph) {
              seen.push(n.dataset.flareMorph)
            }
          })
        }
      }).observe(document.body, { childList: true })
    })
    const morphs = () =>
      page.evaluate(
        () => (window as unknown as { __morphs: string[] }).__morphs
      )

    await nav(page).getByRole("button", { name: "flare", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE)).toBeInViewport()
    await expect.poll(morphs).toEqual(["open"])
    // The clone has handed over: the strip is there, the nav's circle is away.
    await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
    await expect(strip(page)).toBeVisible()
    await expect(strip(page)).not.toHaveClass(/opacity-0/)
    await expect(navCircle(page)).toHaveAttribute("data-hidden", "true")

    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE)).toBeHidden()
    await expect.poll(morphs).toEqual(["open", "close"])
    await expect(navCircle(page)).not.toHaveAttribute("data-hidden", "true")
    await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
    await expect(async () => {
      const pointerEvents = await page.evaluate(
        () => document.body.style.pointerEvents
      )
      expect(pointerEvents === "" || pointerEvents === "auto").toBe(true)
    }).toPass()
    await nav(page)
      .getByRole("button", { name: "my flares", exact: true })
      .click()
    await expect(page).toHaveURL(/\/event$/)
  })
})

test.describe("lighting moment, the morph and the map", () => {
  test("the morph stays on screen while the sheet slides in", async ({
    page,
  }) => {
    await stubBackend(page, { hostedFlares: [] })
    await page.goto("/")
    // The clone's top edge, every frame: it used to follow the strip's live
    // slot down below the screen and back up with the sheet.
    await page.evaluate(() => {
      const tops: number[] = []
      ;(window as unknown as { __tops: number[] }).__tops = tops
      const sample = () => {
        const el = document.querySelector("[data-flare-morph]")
        if (el) tops.push(el.getBoundingClientRect().top)
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await nav(page).getByRole("button", { name: "flare", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE)).toBeInViewport()
    await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
    const tops = await page.evaluate(
      () => (window as unknown as { __tops: number[] }).__tops
    )
    const height = page.viewportSize()!.height
    expect(tops.length).toBeGreaterThan(3)
    for (const top of tops) expect(top).toBeLessThan(height)
  })

  test("a flare lit to start in 15 minutes shows on the map", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [hosted()] })
    await page.getByRole("button", { name: /now · 1h/ }).click()
    await page
      .getByRole("group", { name: "starts" })
      .getByRole("button", { name: "15m" })
      .click()
    await strike(page)
    await expect(page.getByPlaceholder(TITLE)).toBeHidden()
    // The stub's map list stays empty: this is the pin of the flare just lit.
    await expect(
      page.locator('[data-flare-pin="event-e2e-hosted-1"]')
    ).toBeVisible()
  })
})

test.describe("lighting moment, reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("no morph, and the moment is cross-fades only", async ({ page }) => {
    await openComposer(page, { hostedFlares: [] })
    await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
    await expect(navCircle(page)).not.toHaveAttribute("data-hidden", "true")
    await strike(page)
    await expect(moment(page)).toHaveAttribute("data-flare-moment", "launch")
    await expect(moment(page)).toHaveAttribute("data-reduced", "true")
    await expect(moment(page)).toHaveCount(0, { timeout: 10_000 })
  })
})
