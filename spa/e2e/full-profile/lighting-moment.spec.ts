import { expect, test, type Page } from "@playwright/test"
import {
  API_BASE,
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "../support/stubs"

// #375/#376 with `flareLightMoment` (the full profile): the nav's flare button
// morphs into the composer's strike strip, and a strike starts the lighting
// takeover ("night flare") at once. The flare only goes up and lands on the
// map once the api has created it; a failure dismisses the takeover and the
// composer is back. Someone's first flare gets the full burst, every flare
// after it the soft one, and there is never a second pin for the new flare.

const TITLE = "what's the plan? e.g. drinks after work"
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const strip = (page: Page) => page.getByTestId("strike-to-light")
const moment = (page: Page) => page.locator("[data-flare-moment]")
const litPin = (page: Page, id: string) =>
  page.locator(`[data-flare-pin="${id}"]`)
/** The home map layer's own transform: "" whenever no takeover moves it. */
const mapTransform = (page: Page) =>
  page
    .locator("[data-lighting-map]")
    .evaluate((el) => (el as HTMLElement).style.transform)
/** The created flare's id in the stub: one per flare the account hosted. */
const FIRST_ID = "event-e2e-hosted-0"
const LATER_ID = "event-e2e-hosted-1"
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
  await stubBackend(page, {
    hostedFlares: options.hostedFlares,
    friends: 2,
    // #583: with friends, an empty audience asks to pick one instead of
    // lighting, so the friends are in "all friends" as they are in the api.
    circles: [{ _id: "all", name: "all friends", type: "all", memberCount: 2 }],
  })
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

/**
 * Records, every frame, how many pins for the new flare are on screen: the
 * map's own (`id`) and the takeover's stand-in, each counted only while
 * visible (no hidden ancestor, some opacity), plus the map layer's transform.
 */
async function samplePins(page: Page, id: string) {
  await page.evaluate((litId) => {
    const w = window as unknown as {
      __pins: { pins: number; transform: string; moment: boolean }[]
      __pinRun?: number
    }
    const run = (w.__pinRun ?? 0) + 1
    w.__pinRun = run
    w.__pins = []
    const shown = (el: Element) => {
      let a = 1
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.display === "none" || cs.visibility === "hidden") return false
        a *= Number(cs.opacity)
      }
      return a > 0.02
    }
    const tick = () => {
      const circles = [
        ...document.querySelectorAll(
          `[data-flare-pin="${litId}"] [data-pin-circle], [data-flare-pin="lighting-takeover"] [data-pin-circle]`
        ),
      ]
      w.__pins.push({
        pins: circles.filter(shown).length,
        transform:
          document.querySelector<HTMLElement>("[data-lighting-map]")?.style
            .transform ?? "",
        moment: !!document.querySelector("[data-flare-moment]"),
      })
      if (w.__pinRun === run) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, id)
}

async function takePins(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __pins: { pins: number; transform: string; moment: boolean }[]
      __pinRun?: number
    }
    w.__pinRun = (w.__pinRun ?? 0) + 1
    return w.__pins
  })
}

test.describe("lighting moment", () => {
  test("a strike starts the takeover at once, and the flare lands only after the api confirms", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [] })
    // Registered after stubBackend's routes, so it answers POST /events first.
    const create = await holdCreate(page)

    await strike(page)
    // The takeover starts at the strike, before the api has answered, with
    // the full burst for someone's first flare.
    await expect(moment(page)).toHaveAttribute("data-flare-moment", "takeover")
    await expect(moment(page)).toHaveAttribute("data-burst", "full")
    // Never optimistic: it holds, and nothing lands, while the api is out.
    await page.waitForTimeout(1500)
    await expect(moment(page)).toHaveCount(1)
    await expect(litPin(page, FIRST_ID)).toHaveCount(0)

    create.release(true)
    // The flare lands on the map, the moment cleans up, the toast follows.
    await expect(moment(page)).toHaveCount(0, { timeout: 10_000 })
    await expect(litPin(page, FIRST_ID)).toBeVisible()
    await expect(page.getByText(/light it up/).first()).toBeVisible()
    await expect(page.getByPlaceholder(TITLE)).toBeHidden()
    // The map is put back as it was.
    await expect.poll(() => mapTransform(page)).toBe("")
  })

  test("there is never a second pin for the new flare, and the map's pin is there at the end", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [hosted()] })
    await samplePins(page, LATER_ID)
    await strike(page)
    await expect(moment(page)).toHaveAttribute("data-burst", "soft")
    await expect(moment(page)).toHaveCount(0, { timeout: 10_000 })
    await expect(litPin(page, LATER_ID)).toBeVisible()
    const frames = await takePins(page)
    const during = frames.filter((f) => f.moment)
    expect(during.length).toBeGreaterThan(30)
    // The map really moved under it (zoom and tilt), and never two pins.
    expect(during.some((f) => /rotateX/.test(f.transform))).toBe(true)
    for (const f of frames) expect(f.pins).toBeLessThanOrEqual(1)
    // The hand-over leaves exactly one pin, the map's, on an untouched map.
    const after = frames.filter((f) => !f.moment).at(-1)!
    expect(after.pins).toBe(1)
    expect(after.transform).toBe("")
  })

  test("a tap lights it too, as the accessible alternative", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [hosted()] })
    await strip(page).click()
    await expect(moment(page)).toHaveAttribute("data-flare-moment", "takeover")
    await expect(moment(page)).toHaveCount(0, { timeout: 10_000 })
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

  test("an api failure dismisses the takeover and keeps today's error", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [] })
    // Registered after stubBackend's routes, so it answers POST /events first.
    const create = await holdCreate(page)
    await strike(page)
    await expect(moment(page)).toHaveCount(1)
    await page.waitForTimeout(400)
    create.release(false)
    await expect(page.getByText("couldn't light that flare")).toBeVisible()
    // Never stuck on the veil: it goes, and the composer is back with the
    // draft, ready to strike again.
    await expect(moment(page)).toHaveCount(0, { timeout: 2_000 })
    await expect(page.getByPlaceholder(TITLE)).toBeInViewport()
    await expect(page.getByPlaceholder(TITLE)).toHaveValue("park in a bit")
    await expect(strip(page)).toContainText(/swipe to light|go live/)
    await expect.poll(() => mapTransform(page)).toBe("")
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

    await page.getByRole("button", { name: "close", exact: true }).click()
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
    await page.getByRole("button", { name: "close", exact: true }).click()
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

  test("no morph, and the takeover is cross-fades only: the map never moves", async ({
    page,
  }) => {
    await openComposer(page, { hostedFlares: [] })
    await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
    await expect(navCircle(page)).not.toHaveAttribute("data-hidden", "true")
    await samplePins(page, FIRST_ID)
    await strike(page)
    await expect(moment(page)).toHaveAttribute("data-reduced", "true")
    await expect(moment(page)).toHaveCount(0, { timeout: 10_000 })
    await expect(litPin(page, FIRST_ID)).toBeVisible()
    const frames = await takePins(page)
    for (const f of frames) {
      expect(f.transform).toBe("")
      expect(f.pins).toBeLessThanOrEqual(1)
    }
  })
})
