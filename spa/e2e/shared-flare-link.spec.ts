import { expect, test, type Page } from "@playwright/test"
import {
  API_BASE,
  AUTH_BASE,
  makeStubFlare,
  makeStubPublicPin,
  stubBackend,
} from "./support/stubs"

// A shared flare link (`/?flare=<id>`): a signed-out visitor lands on the map
// opened on that open-to-all flare, with its card up. A first open shows the
// intro slides first, as an invite link does (#560); there is no location ask. The card shows the title and
// what a pin shows (#425), not the host or guests. "join" asks for an account, and signing up lands them on the
// flare. Someone signed in goes straight to the flare, and a flare's own page
// opened signed out turns into the link.

const ID = "6650a1b2c3d4e5f6a7b8c9d0"
const MIN = 60_000

const sharedPin = (overrides = {}) =>
  makeStubPublicPin({
    _id: ID,
    type: "drinks",
    location: { type: "Point", coordinates: [13.41, 52.53] },
    ...overrides,
  })

const card = (page: Page) => page.locator("[data-shared-flare]")
const slides = (page: Page) => page.locator("[data-intro-slide]")
const sheet = (page: Page) => page.locator('[data-sheet="sign up"]')

/** Requests a signed-out visitor must never make (see #389's spec). */
function watchForAccountCalls(page: Page): string[] {
  const offending: string[] = []
  page.on("request", (request) => {
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

test.describe("shared flare link", () => {
  test("opens the map on the flare, and join → sign up → the flare", async ({
    page,
  }) => {
    await stubBackend(page, {
      signedOut: true,
      publicPins: [sharedPin()],
      publicFlareTitle: "drinks at the canal",
      events: [makeStubFlare({ _id: ID, title: "drinks at the canal" })],
    })
    const offending = watchForAccountCalls(page)
    await page.goto(`/?flare=${ID}`)

    await expect(card(page)).toHaveAttribute("data-shared-flare", ID)
    await expect(card(page)).toContainText("drinks at the canal")
    await expect(card(page)).toContainText(
      /drinks · open to all · live now · until /
    )
    await expect(page.locator(`[data-flare-pin="${ID}"]`)).toBeVisible()
    // Straight to the flare: no intro slides and no location ask.
    await expect(page.getByText("where should the map start?")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "sign in", exact: true })
    ).toBeVisible()

    await card(page)
      .getByRole("button", { name: "see who's going and join" })
      .click()
    await expect(sheet(page)).toContainText("sign up to join")
    await expect(
      sheet(page).getByRole("link", { name: "i have an account" })
    ).toHaveAttribute("href", `/login?redirectTo=%2Fevent%2F${ID}`)
    await sheet(page).getByRole("link", { name: "create an account" }).click()
    await expect(page).toHaveURL(`/register?redirectTo=%2Fevent%2F${ID}`)
    expect(offending).toEqual([])

    await page.getByLabel("your name").fill("Sam")
    await page.getByLabel("username").fill("sam")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /create account/i }).click()

    await expect(page).toHaveURL(`/event/${ID}`)
    await expect(page.getByText("drinks at the canal").first()).toBeVisible()
  })

  test("a first open shows the intro slides, then the flare, once per device", async ({
    page,
  }) => {
    await stubBackend(page, {
      signedOut: true,
      introSlides: true,
      publicPins: [sharedPin()],
    })
    await page.goto(`/?flare=${ID}`)

    await expect(slides(page)).toBeVisible()
    await slides(page).getByRole("button", { name: "next" }).click()
    await slides(page).getByRole("button", { name: "next" }).click()
    await slides(page).getByRole("button", { name: "see the flare" }).click()
    await expect(slides(page)).toHaveCount(0)

    await expect(page).toHaveURL(`/?flare=${ID}`)
    await expect(card(page)).toHaveAttribute("data-shared-flare", ID)
    await expect(page.getByText("where should the map start?")).toHaveCount(0)

    await page.reload()
    await expect(card(page)).toHaveAttribute("data-shared-flare", ID)
    await expect(slides(page)).toHaveCount(0)
  })

  test("'i have an account' on the slides leads to the flare", async ({
    page,
  }) => {
    await stubBackend(page, {
      signedOut: true,
      introSlides: true,
      publicPins: [sharedPin()],
    })
    await page.goto(`/?flare=${ID}`)

    await slides(page)
      .getByRole("button", { name: /i have an account/i })
      .click()
    await expect(page).toHaveURL(`/login?redirectTo=%2Fevent%2F${ID}`)
  })

  test("a flare later than the map's window is there, with its start time", async ({
    page,
  }) => {
    await stubBackend(page, {
      signedOut: true,
      publicPins: [
        sharedPin({
          startAt: new Date(Date.now() + 3 * 24 * 60 * MIN).toISOString(),
          endAt: new Date(Date.now() + (3 * 24 * 60 + 120) * MIN).toISOString(),
        }),
      ],
    })
    await page.goto(`/?flare=${ID}`)

    await expect(card(page)).toContainText(/^.*starts [a-z]{3} /)
    // Closing the card and tapping the pin brings it back.
    await card(page).getByRole("button", { name: "close flare" }).click()
    await expect(card(page)).toHaveCount(0)
    await page.locator(`[data-flare-pin="${ID}"]`).click()
    await expect(card(page)).toHaveAttribute("data-shared-flare", ID)
    await expect(sheet(page)).toHaveCount(0)
  })

  test("a flare's own page, signed out, opens as the link", async ({
    page,
  }) => {
    await stubBackend(page, { signedOut: true, publicPins: [sharedPin()] })
    await page.goto(`/event/${ID}`)

    await expect(page).toHaveURL(`/?flare=${ID}`)
    await expect(card(page)).toHaveAttribute("data-shared-flare", ID)
  })

  test("a flare that isn't open says so, with a way to sign in to it", async ({
    page,
  }) => {
    await stubBackend(page, { signedOut: true, publicPins: [] })
    await page.goto(`/event/${ID}`)

    await expect(card(page)).toHaveAttribute("data-shared-flare", "gone")
    await expect(card(page)).toContainText("this flare isn't open")
    await expect(
      card(page).getByRole("link", { name: "sign in" })
    ).toHaveAttribute("href", `/login?redirectTo=%2Fevent%2F${ID}`)
  })

  test("signed in, the link goes straight to the flare", async ({ page }) => {
    await stubBackend(page, {
      events: [makeStubFlare({ _id: ID, title: "drinks at the canal" })],
    })
    await page.goto(`/?flare=${ID}`)

    await expect(page).toHaveURL(`/event/${ID}`)
    await expect(page.getByText("drinks at the canal").first()).toBeVisible()
  })
})
