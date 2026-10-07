import { expect, test, type Page, type Request } from "@playwright/test"
import {
  API_BASE,
  AUTH_BASE,
  makeStubPublicPin,
  stubBackend,
} from "../support/stubs"

// #389: with `browseBeforeSignup` (the full profile), a signed-out visitor
// lands on the home map: idea spots and open-to-all pins, nothing that needs
// an account. Lighting a flare, a pin or an account-only tab opens one
// sign-up sheet, and signing up brings them back to the flare they started.
//
// The idea list has date-dependent seasons, so the clock is fixed to a day
// when five spots around kreuzberg (the signed-out centre) are in season.
const JUNE = "2026-06-15T12:00:00.000Z"
const JUNE_MS = Date.parse(JUNE)
const MIN = 60_000

const MAYBACH = "market lunch at the maybachufer"

const PUBLIC_PINS = [
  makeStubPublicPin({
    _id: "public-live",
    type: "drinks",
    location: { type: "Point", coordinates: [13.4, 52.51] },
    startAt: new Date(JUNE_MS - 10 * MIN).toISOString(),
    endAt: new Date(JUNE_MS + 90 * MIN).toISOString(),
  }),
  makeStubPublicPin({
    _id: "public-soon",
    type: "sports",
    location: { type: "Point", coordinates: [13.44, 52.49] },
    startAt: new Date(JUNE_MS + 60 * MIN).toISOString(),
    endAt: new Date(JUNE_MS + 180 * MIN).toISOString(),
  }),
]

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const sheet = (page: Page) => page.locator('[data-sheet="sign up"]')
const welcome = (page: Page) => page.locator('[data-sheet="welcome in"]')
const ideaPins = (page: Page) => page.locator("[data-idea-pin]")
const flarePins = (page: Page) => page.locator("[data-flare-pin]")
const composerTitle = (page: Page) =>
  page.getByPlaceholder("what's the plan? e.g. drinks after work")

/**
 * Every request a signed-out visitor must never make: anything on the auth
 * server or the api other than the health pings and the public endpoints, and
 * anything carrying a token.
 */
function watchForAccountCalls(page: Page): string[] {
  const offending: string[] = []
  page.on("request", (request: Request) => {
    const url = new URL(request.url())
    const label = `${request.method()} ${url.origin}${url.pathname}`
    if (request.headers()["authorization"]) {
      offending.push(`${label} (with a token)`)
      return
    }
    if (url.origin === new URL(AUTH_BASE).origin) {
      if (url.pathname !== "/health") offending.push(label)
      return
    }
    if (url.origin === new URL(API_BASE).origin) {
      const path = url.pathname.replace(/^\/api\/v1/, "")
      if (path !== "/health" && !path.startsWith("/public/")) {
        offending.push(label)
      }
    }
  })
  return offending
}

async function openSignedOutMap(
  page: Page,
  options: { friends?: number } = {}
) {
  await page.clock.setFixedTime(JUNE)
  await stubBackend(page, {
    signedOut: true,
    publicPins: PUBLIC_PINS,
    friends: options.friends,
  })
  const offending = watchForAccountCalls(page)
  await page.goto("/")
  await expect(nav(page)).toBeVisible()
  return offending
}

test.describe("browse before sign-up (#389)", () => {
  test("a signed-out visitor sees idea spots and open-to-all pins, and loads nothing that needs an account", async ({
    page,
  }) => {
    const publicRequests: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/public/events/map")) {
        publicRequests.push(request.url())
      }
    })
    const offending = await openSignedOutMap(page)

    // No redirect to /login.
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("button", { name: "sign in" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "invite", exact: true })
    ).toHaveCount(0)

    await expect(ideaPins(page)).toHaveCount(5)
    await expect(
      page.getByRole("button", { name: `idea: ${MAYBACH}` })
    ).toBeVisible()
    await expect(flarePins(page)).toHaveCount(2)
    for (const pin of await flarePins(page).all()) {
      await expect(pin).toHaveAttribute("data-visibility", "public")
    }
    // #490: no pin legend under the top bar.
    await expect(page.locator("[data-map-legend]")).toHaveCount(0)
    await expect(page.getByText("2 open flares in berlin")).toBeVisible()
    // The area is in the sheet's heading, not a chip of its own (#496).
    await expect(page.getByText("berlin", { exact: true })).toHaveCount(0)

    // The live / soon tabs narrow the pins.
    await page.getByRole("tab", { name: "live" }).click()
    await expect(flarePins(page)).toHaveCount(1)
    await expect(page.locator('[data-flare-pin="public-live"]')).toBeVisible()
    await page.getByRole("tab", { name: "soon" }).click()
    await expect(page.locator('[data-flare-pin="public-soon"]')).toBeVisible()
    await expect(flarePins(page)).toHaveCount(1)

    // The pins came from the public endpoint, around berlin.
    expect(publicRequests.length).toBeGreaterThan(0)
    const asked = new URL(publicRequests[0])
    expect(Number(asked.searchParams.get("lat"))).toBeCloseTo(52.5, 1)
    expect(Number(asked.searchParams.get("lng"))).toBeCloseTo(13.42, 1)

    // Let anything polling or retrying have its go before checking.
    await page.waitForTimeout(1_000)
    expect(offending).toEqual([])
  })

  test("tapping a pin opens the sign-up sheet, with no details", async ({
    page,
  }) => {
    const offending = await openSignedOutMap(page)

    await page.locator('[data-flare-pin="public-live"]').click()
    await expect(sheet(page)).toBeVisible()
    await expect(
      sheet(page).getByText("sign up to see what's happening")
    ).toBeVisible()
    await expect(
      sheet(page).getByRole("link", { name: "create an account" })
    ).toHaveAttribute("href", "/register")
    await expect(
      sheet(page).getByRole("link", { name: "i have an account" })
    ).toHaveAttribute("href", "/login")

    expect(offending).toEqual([])
  })

  test("feed, circles and my flares open the sheet instead of navigating", async ({
    page,
  }) => {
    const offending = await openSignedOutMap(page)

    for (const [tab, noun] of [
      ["Feed", "feed"],
      ["Circles", "circles"],
      ["my flares", "flares"],
    ] as const) {
      await nav(page).getByRole("button", { name: tab, exact: true }).click()
      await expect(
        sheet(page).getByText(`sign up to see your ${noun}`)
      ).toBeVisible()
      await expect(page).toHaveURL(/\/$/)
      await page.keyboard.press("Escape")
      await expect(sheet(page)).toBeHidden()
    }

    expect(offending).toEqual([])
  })

  test("the nav's flare button asks to sign up with a blank flare kept, and the map has no fab (#491)", async ({
    page,
  }) => {
    const offending = await openSignedOutMap(page)

    await nav(page).getByRole("button", { name: "flare", exact: true }).click()
    await expect(sheet(page).getByText("sign up to light it")).toBeVisible()
    await expect(
      sheet(page).getByText(
        "flares go to friends, so they need an account. only the friends you pick will see it."
      )
    ).toBeVisible()
    await expect(
      sheet(page).locator('[data-kept-draft="blank"]')
    ).toContainText("your flare")
    await page.keyboard.press("Escape")
    await expect(sheet(page)).toBeHidden()

    await expect(
      page.getByRole("button", { name: "Light a flare", exact: true })
    ).toHaveCount(0)
    // The tap didn't open the composer.
    await expect(composerTitle(page)).not.toBeInViewport()

    expect(offending).toEqual([])
  })

  test("an idea, then sign-up, lands back in the composer with the idea", async ({
    page,
  }) => {
    // With a friend already, so "let's light it up" goes straight to the
    // composer (#459 puts a first-friend step first for 0 friends; see
    // post-signup-checklist.spec.ts).
    const offending = await openSignedOutMap(page, { friends: 1 })

    await page.getByRole("button", { name: `idea: ${MAYBACH}` }).click()
    const card = page.locator("[data-quiet-card]")
    await expect(card.getByText(MAYBACH)).toBeVisible()
    await card.getByRole("button", { name: "light a flare" }).click()

    await expect(sheet(page).getByText("sign up to light it")).toBeVisible()
    const kept = sheet(page).locator('[data-kept-draft="maybachufer-market"]')
    await expect(kept).toContainText(MAYBACH)
    await expect(kept).toContainText("kept for after sign-up")

    await sheet(page).getByRole("link", { name: "create an account" }).click()
    await expect(page).toHaveURL(/\/register\?redirectTo=%2F%3Fresume%3Dflare$/)
    // Everything up to the account being made stayed signed out.
    expect(offending).toEqual([])

    await page.getByLabel("your name").fill("Sam")
    await page.getByLabel("username").fill("sam")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /create account/i }).click()

    await expect(
      welcome(page).getByText("welcome in. here's the flare you started.")
    ).toBeVisible()
    await expect(welcome(page)).toContainText(MAYBACH)
    // The trip back is used up, and the welcome replaces the first-run intro.
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole("heading", { name: "see flares near you" })
    ).toHaveCount(0)

    await welcome(page)
      .getByRole("button", { name: "let's light it up" })
      .click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue(MAYBACH)
    await expect(
      page.getByRole("button", { name: "Wochenmarkt am Maybachufer" })
    ).toBeVisible()
  })

  test("signing in from the sheet comes back to a blank flare, and not now lets it go", async ({
    page,
  }) => {
    await openSignedOutMap(page)

    await nav(page).getByRole("button", { name: "flare", exact: true }).click()
    await sheet(page).getByRole("link", { name: "i have an account" }).click()
    await expect(page).toHaveURL(/\/login\?redirectTo=%2F%3Fresume%3Dflare$/)

    await page.getByLabel("email").fill("flaretester@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: "sign in", exact: true }).click()

    await expect(welcome(page)).toBeVisible()
    await expect(
      welcome(page).locator('[data-kept-draft="blank"]')
    ).toBeVisible()
    await welcome(page).getByRole("button", { name: "not now" }).click()
    await expect(welcome(page)).toBeHidden()
    await expect(composerTitle(page)).not.toBeInViewport()

    // Nothing asks again after a reload.
    await page.reload()
    await expect(nav(page)).toBeVisible()
    await expect(welcome(page)).toHaveCount(0)
  })

  test("sign in in the header goes to the sign-in page without a kept draft", async ({
    page,
  }) => {
    await openSignedOutMap(page)
    await page.getByRole("button", { name: "sign in" }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})

// #457: the Impressum has to be directly reachable from the signed-out map
// (§ 5 DDG), and the back arrow returns to where the visitor was (#295).
test.describe("legal links before sign-up (#457)", () => {
  const legal = (page: Page) => page.getByRole("navigation", { name: "legal" })
  const back = (page: Page) => page.getByRole("link", { name: "back" })

  test("the map reaches the impressum in one tap, and back returns to the map", async ({
    page,
  }) => {
    const offending = await openSignedOutMap(page)
    await expect(flarePins(page)).toHaveCount(2)

    await legal(page).getByRole("link", { name: "impressum" }).click()
    await expect(page).toHaveURL(/\/menu\/impressum$/)
    await expect(
      page.getByRole("heading", { name: "Legal notice" })
    ).toBeVisible()

    await back(page).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(flarePins(page)).toHaveCount(2)
    expect(offending).toEqual([])
  })

  test("the map also links the privacy note and the terms", async ({
    page,
  }) => {
    await openSignedOutMap(page)
    await expect(
      legal(page).getByRole("link", { name: "privacy" })
    ).toHaveAttribute("href", "/menu/privacy")
    await expect(
      legal(page).getByRole("link", { name: "terms" })
    ).toHaveAttribute("href", "/menu/terms")
  })

  test("the sign-up sheet links them too, and back returns to the map", async ({
    page,
  }) => {
    await openSignedOutMap(page)
    await nav(page).getByRole("button", { name: "flare", exact: true }).click()
    await expect(sheet(page)).toBeVisible()

    await sheet(page).getByRole("link", { name: "impressum" }).click()
    await expect(page).toHaveURL(/\/menu\/impressum$/)

    await back(page).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(nav(page)).toBeVisible()
  })

  test("the sign-in page links them, and back returns to it", async ({
    page,
  }) => {
    await openSignedOutMap(page)
    await page.getByRole("button", { name: "sign in" }).click()
    await expect(page).toHaveURL(/\/login$/)

    await legal(page).getByRole("link", { name: "impressum" }).click()
    await expect(page).toHaveURL(/\/menu\/impressum$/)
    await back(page).click()
    await expect(page).toHaveURL(/\/login$/)

    await expect(
      legal(page).getByRole("link", { name: "privacy" })
    ).toHaveAttribute("href", "/menu/privacy")
    await expect(
      legal(page).getByRole("link", { name: "terms" })
    ).toHaveAttribute("href", "/menu/terms")
  })

  test("the register page still links them, and back returns to it", async ({
    page,
  }) => {
    await openSignedOutMap(page)
    await page.goto("/register")
    await page.getByRole("link", { name: "impressum" }).click()
    await expect(page).toHaveURL(/\/menu\/impressum$/)
    await back(page).click()
    await expect(page).toHaveURL(/\/register$/)
  })
})
