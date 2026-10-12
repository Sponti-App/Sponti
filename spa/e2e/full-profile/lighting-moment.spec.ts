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
  // The morph is over and the sheet has landed, so the strip stays put under
  // the strike (a strike aimed at a strip still sliding in can miss it).
  await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
  let lastY = NaN
  await expect
    .poll(async () => {
      const y = (await strip(page).boundingBox())?.y ?? NaN
      const settled = y === lastY
      lastY = y
      return settled
    })
    .toBe(true)
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

type Frame = {
  clone: { left: number; top: number; bottom: number } | null
  navShown: boolean
  stripShown: boolean
}

/**
 * Records, every frame, what of the morph is on screen: the clone's visible
 * shape (its box after the transform and the clip), whether the nav's circle
 * and the real strip show.
 */
async function samplePerFrame(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: unknown[]; __run?: number }
    const run = (w.__run ?? 0) + 1
    w.__run = run
    w.__frames = []
    const num = (re: RegExp, str: string, i: number, fallback: number) => {
      const m = re.exec(str)
      return m ? Number(m[i]) : fallback
    }
    const shown = (el: Element | null) =>
      !!el &&
      getComputedStyle(el).visibility !== "hidden" &&
      Number(getComputedStyle(el).opacity) > 0 &&
      el.getBoundingClientRect().top < window.innerHeight
    const tick = () => {
      const g = document.querySelector<HTMLElement>("[data-flare-morph]")
      let clone = null
      if (g) {
        const st = g.style
        const left = parseFloat(st.left)
        const top = parseFloat(st.top)
        const width = parseFloat(st.width)
        const height = parseFloat(st.height)
        const tr = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/
        const dx = num(tr, st.transform, 1, 0)
        const dy = num(tr, st.transform, 2, 0)
        const s = num(tr, st.transform, 3, 1)
        const clip = /inset\(([-\d.]+)px ([-\d.]+)px/
        const cy = num(clip, st.clipPath, 1, 0)
        const cr = num(clip, st.clipPath, 2, 0)
        const ox = parseFloat(st.transformOrigin)
        const x = (v: number) => left + ox + (v - ox) * s + dx
        const y = (v: number) => top + height / 2 + (v - height / 2) * s + dy
        clone = {
          left: x(0),
          top: y(cy),
          bottom: y(height - cy),
          right: x(width - cr),
        }
      }
      w.__frames.push({
        clone,
        navShown: shown(document.querySelector("[data-nav-flare-circle]")),
        stripShown: shown(document.querySelector("[data-strike-strip]")),
      })
      if (w.__run === run) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function takeSamples(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __frames: Frame[]; __run?: number }
    w.__run = (w.__run ?? 0) + 1
    return w.__frames
  })
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
  test("the morph travels straight between the button and the strip, with one of them always on screen", async ({
    page,
  }) => {
    await stubBackend(page, { hostedFlares: [] })
    await page.goto("/")
    await expect(navCircle(page)).toBeVisible()
    await samplePerFrame(page)
    await nav(page).getByRole("button", { name: "flare", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE)).toBeInViewport()
    await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
    const rest = (await strip(page).boundingBox())!
    const opening = await takeSamples(page)
    const height = page.viewportSize()!.height

    const clones = opening.filter((f) => f.clone)
    expect(clones.length).toBeGreaterThan(3)
    let prevTop = Infinity
    for (const f of clones) {
      const c = f.clone!
      // On screen, never above where the strip rests, rising only: it used
      // to follow the sliding sheet off the bottom of the screen and back
      // (on device), then to swing up past the strip and drop back onto it.
      expect(c.bottom).toBeLessThanOrEqual(height)
      expect(c.top).toBeGreaterThanOrEqual(rest.y - 1)
      expect(c.top).toBeLessThanOrEqual(prevTop + 0.5)
      prevTop = c.top
      // The clone stands in for the strip: never both at once.
      expect(f.stripShown).toBe(false)
    }
    // Every frame shows the button, the clone or the strip.
    for (const f of opening) {
      expect(f.navShown || !!f.clone || f.stripShown).toBe(true)
    }

    await samplePerFrame(page)
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE)).toBeHidden()
    await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
    await expect(navCircle(page)).toBeVisible()
    const closing = await takeSamples(page)
    const back = closing.filter((f) => f.clone)
    expect(back.length).toBeGreaterThan(3)
    let prevLeft = -Infinity
    for (const f of back) {
      // Straight back to the button: the pill closes from the right.
      expect(f.clone!.bottom).toBeLessThanOrEqual(height)
      expect(f.clone!.left).toBeGreaterThanOrEqual(prevLeft - 0.5)
      prevLeft = f.clone!.left
    }
    // No frame without the button or its clone, once the strip is gone.
    for (const f of closing) {
      expect(f.navShown || !!f.clone || f.stripShown).toBe(true)
    }
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

  test("a flare lit for now is live on the map at once", async ({ page }) => {
    await openComposer(page, { hostedFlares: [hosted()] })
    await strike(page)
    await expect(page.getByPlaceholder(TITLE)).toBeHidden()
    // Not "soon" until the map's next minute tick.
    await expect(
      page.locator('[data-flare-pin="event-e2e-hosted-1"]')
    ).toHaveAttribute("data-live", "true")
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
