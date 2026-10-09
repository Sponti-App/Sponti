import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { makeStubPublicPin, stubBackend } from "../support/stubs"

// #408: with `locationAsk` (the full profile), the map's sheet asks where the
// map should start instead of the browser prompting on mount. "use my
// location" asks the browser (only after the tap); denied or blocked turns
// the sheet into "pick an area to start", with a place search. A picked area
// shows a banner, and the choice is remembered on the device.
//
// Geolocation is Playwright's own: the `geolocation` context option and
// granting (or not granting) the permission. A spy counts the calls, so the
// spec can check the browser is never asked before the tap.

// A day when the berlin idea spots are in season.
const JUNE = "2026-06-15T12:00:00.000Z"
const HERE = { latitude: 52.53, longitude: 13.41 }
const HAMBURG = { lat: 53.5511, lng: 9.9937 }

const NEARBY_PIN = makeStubPublicPin({
  _id: "public-nearby",
  type: "drinks",
  location: { type: "Point", coordinates: [HERE.longitude, HERE.latitude] },
  startAt: "2026-06-15T11:50:00.000Z",
  endAt: "2026-06-15T14:00:00.000Z",
})

// No permission granted: the browser would prompt, and a request without a
// grant is denied, as when someone taps "block".
test.use({ geolocation: HERE })

const sheet = (page: Page) => page.locator('[data-sheet="location"]')
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
// Under the modal sheet the nav is aria-hidden, so it has no role there.
const navNode = (page: Page) => page.locator('nav[aria-label="Primary"]')
const banner = (page: Page) => page.locator("[data-area-banner]")
const ideaPins = (page: Page) => page.locator("[data-idea-pin]")

/** Counts every position request the page makes. */
async function spyOnGeolocation(page: Page) {
  await page.addInitScript(() => {
    const geo = navigator.geolocation
    const w = window as unknown as { __geoCalls: number }
    w.__geoCalls = 0
    const get = geo.getCurrentPosition.bind(geo)
    const watch = geo.watchPosition.bind(geo)
    geo.getCurrentPosition = (...args) => {
      w.__geoCalls += 1
      return get(...args)
    }
    geo.watchPosition = (...args) => {
      w.__geoCalls += 1
      return watch(...args)
    }
  })
}

const geoCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls)

/** The public map requests, as their centre. */
function watchPublicCentres(page: Page): Array<{ lat: number; lng: number }> {
  const centres: Array<{ lat: number; lng: number }> = []
  page.on("request", (request) => {
    if (!request.url().includes("/public/events/map")) return
    const url = new URL(request.url())
    centres.push({
      lat: Number(url.searchParams.get("lat")),
      lng: Number(url.searchParams.get("lng")),
    })
  })
  return centres
}

/** The place search: hamburg, through the same proxy the composer uses. */
async function stubPlaces(page: Page, available = true) {
  await page.route("**/api/places?*", (route) =>
    available
      ? route.fulfill({
          json: {
            suggestions: [
              {
                placeId: "place-hamburg",
                label: "Hamburg",
                address: "Germany",
              },
            ],
          },
        })
      : route.fulfill({
          status: 500,
          json: { suggestions: [], error: "missing API key" },
        })
  )
  await page.route("**/api/places/place-hamburg", (route) =>
    route.fulfill({
      json: {
        placeId: "place-hamburg",
        name: "Hamburg",
        address: "Hamburg, Germany",
        ...HAMBURG,
      },
    })
  )
}

async function openSignedOut(
  page: Page,
  options: { places?: boolean; introSlides?: boolean; pins?: boolean } = {}
) {
  await page.clock.setFixedTime(JUNE)
  await spyOnGeolocation(page)
  await stubPlaces(page, options.places ?? true)
  await stubBackend(page, {
    signedOut: true,
    locationAsk: true,
    introSlides: options.introSlides ?? false,
    publicPins: options.pins ? [NEARBY_PIN] : [],
  })
  await page.goto("/")
  await expect(navNode(page)).toBeVisible()
}

/** Tap "use my location" with the permission not granted: a denial. */
async function denyLocation(page: Page) {
  await sheet(page).getByRole("button", { name: "use my location" }).click()
  await expect(
    sheet(page).getByText("pick an area to start", { exact: true })
  ).toBeVisible()
}

async function grant(context: BrowserContext) {
  await context.grantPermissions(["geolocation"])
}

test.describe("location ask (#408)", () => {
  test("ask → allow: the prompt only comes after the tap, and the map opens near you", async ({
    page,
    context,
  }) => {
    const centres = watchPublicCentres(page)
    await openSignedOut(page, { pins: true })

    await expect(
      sheet(page).getByText("where should the map start?")
    ).toBeVisible()
    await expect(
      sheet(page).getByText("so the map opens on what's near you.")
    ).toBeVisible()
    await expect(
      sheet(page).getByRole("button", { name: "kreuzberg" })
    ).toBeVisible()
    // Nothing has asked the browser yet.
    expect(await geoCalls(page)).toBe(0)

    await grant(context)
    await sheet(page).getByRole("button", { name: "use my location" }).click()

    await expect(sheet(page)).toHaveCount(0)
    expect(await geoCalls(page)).toBeGreaterThan(0)
    // The sheet's heading says it; there is no separate "near you" chip (#496).
    await expect(page.getByText("1 open flare near you")).toBeVisible()
    await expect(page.getByText("near you", { exact: true })).toHaveCount(0)
    await expect(banner(page)).toHaveCount(0)
    await expect
      .poll(() => centres.at(-1))
      .toEqual({ lat: HERE.latitude, lng: HERE.longitude })

    // A second visit doesn't ask again.
    await page.reload()
    await expect(nav(page)).toBeVisible()
    await expect(page.getByText("1 open flare near you")).toBeVisible()
    await expect(sheet(page)).toHaveCount(0)
  })

  test("ask → deny → pick an area: the banner, blocked help, and a second visit not asking", async ({
    page,
  }) => {
    const centres = watchPublicCentres(page)
    await openSignedOut(page)
    await denyLocation(page)

    await expect(
      sheet(page).getByText(
        "no problem. you can turn location on later in your browser settings."
      )
    ).toBeVisible()
    await expect(
      sheet(page).getByPlaceholder("search a neighbourhood or city")
    ).toBeVisible()
    await expect(
      sheet(page).getByText(
        "idea spots are berlin-only for now. elsewhere the map starts empty."
      )
    ).toBeVisible()
    // No peach button left in the picker.
    await expect(
      sheet(page).getByRole("button", { name: "use my location" })
    ).toHaveCount(0)

    await sheet(page).getByRole("button", { name: "neukölln" }).click()
    await expect(sheet(page)).toHaveCount(0)
    await expect(banner(page)).toContainText("showing neukölln")
    await expect(banner(page)).not.toContainText("location is blocked")
    await expect
      .poll(() => centres.at(-1))
      .toEqual({ lat: 52.4811, lng: 13.435 })
    await expect(ideaPins(page).first()).toBeVisible()

    // Location is blocked: the banner says how to turn it back on.
    await banner(page).getByRole("button", { name: "use my location" }).click()
    await expect(banner(page)).toContainText(
      "location is blocked for sponti. allow it in your browser's site settings"
    )

    // Remembered on this device.
    await page.reload()
    await expect(nav(page)).toBeVisible()
    await expect(banner(page)).toContainText("showing neukölln")
    await expect(sheet(page)).toHaveCount(0)
  })

  test("search finds a place outside berlin, which opens an empty map", async ({
    page,
  }) => {
    const centres = watchPublicCentres(page)
    await openSignedOut(page)
    await denyLocation(page)

    await sheet(page)
      .getByPlaceholder("search a neighbourhood or city")
      .fill("hamburg")
    const result = sheet(page).getByRole("button", { name: /hamburg/ })
    await expect(result).toContainText("no idea spots there yet")
    await result.click()

    await expect(sheet(page)).toHaveCount(0)
    await expect(banner(page)).toContainText("showing hamburg")
    await expect.poll(() => centres.at(-1)).toEqual(HAMBURG)
    // The spots are berlin-only; the place-less ideas (#515) still float
    // around the map's centre, so the hint points at them.
    await expect(
      page.getByText(
        "no flares yet, and no idea spots there yet. the dashed ones work anywhere, tap one."
      )
    ).toBeVisible()
    await expect(ideaPins(page)).toHaveCount(0)
    await expect(page.locator("[data-floating-idea]")).toHaveCount(3)
  })

  test("without the place search, the chips are the search", async ({
    page,
  }) => {
    await openSignedOut(page, { places: false })
    await denyLocation(page)
    const search = sheet(page).getByPlaceholder(
      "search a neighbourhood or city"
    )

    await search.fill("kreuz")
    await expect(
      sheet(page).getByRole("button", { name: "kreuzberg" })
    ).toBeVisible()
    await expect(
      sheet(page).getByRole("button", { name: "mitte" })
    ).toHaveCount(0)

    await search.fill("hamburg")
    await expect(
      sheet(page).getByText(
        "search isn't available right now. pick an area instead."
      )
    ).toBeVisible()
    await sheet(page).getByRole("button", { name: "mitte" }).click()
    await expect(banner(page)).toContainText("showing mitte")
  })

  test.describe("with location already blocked in the browser", () => {
    test.use({ permissions: [] })

    test("it goes straight to pick an area, without asking", async ({
      page,
    }) => {
      await openSignedOut(page)

      await expect(
        sheet(page).getByText("pick an area to start", { exact: true })
      ).toBeVisible()
      expect(await geoCalls(page)).toBe(0)
      await sheet(page).getByRole("button", { name: "wedding" }).click()
      await expect(banner(page)).toContainText("showing wedding")
    })
  })

  test("the ask waits for the intro slides", async ({ page }) => {
    await openSignedOut(page, { introSlides: true })
    const slides = page.locator("[data-intro-slide]")
    await expect(slides).toBeVisible()
    await expect(sheet(page)).toHaveCount(0)

    await slides.getByRole("button", { name: "skip" }).click()
    await expect(slides).toHaveCount(0)
    await expect(
      sheet(page).getByText("where should the map start?")
    ).toBeVisible()
    expect(await geoCalls(page)).toBe(0)
  })

  test("a signed-in user who hasn't decided gets the ask instead of the prompt", async ({
    page,
  }) => {
    await page.clock.setFixedTime(JUNE)
    await spyOnGeolocation(page)
    await stubBackend(page, { locationAsk: true })
    await page.goto("/")
    await expect(navNode(page)).toBeVisible()

    await expect(
      sheet(page).getByText("where should the map start?")
    ).toBeVisible()
    expect(await geoCalls(page)).toBe(0)

    await sheet(page).getByRole("button", { name: "friedrichshain" }).click()
    await expect(sheet(page)).toHaveCount(0)
    await expect(banner(page)).toContainText("showing friedrichshain")
    expect(await geoCalls(page)).toBe(0)
  })
})
