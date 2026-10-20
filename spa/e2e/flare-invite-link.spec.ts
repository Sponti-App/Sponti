import { expect, test, type Page } from "@playwright/test"
import { INVITE_TOKEN, stubFlareInvite } from "./support/flare-invite-stubs"
import {
  API_BASE,
  AUTH_BASE,
  STUB_USER,
  makeStubFlare,
  stubBackend,
} from "./support/stubs"

// #616: a flare's own invite link. The host's "invite" button hands it to the
// share sheet (or copies it); a guest opens /f/<token>, sees who invited them
// and, signed out, signs up and comes back to it already saying "i'm in". An
// invite-only flare waits on the host instead of opening.

const EVENT_ID = "6650a1b2c3d4e5f6a7b8c9d0"
// A flare opens in the drawer on the home map (#615).
const drawer = (page: Page) => page.locator(`[data-flare-drawer="${EVENT_ID}"]`)
const HOST = {
  _id: "user-e2e-host",
  username: "patrick",
  displayName: "Patrick Caire",
  avatarUrl: null,
}
const ADDRESS = "47 chandos pl"

const flare = (overrides = {}) =>
  makeStubFlare({
    _id: EVENT_ID,
    hostId: HOST,
    title: "drinks at klunkerkranich",
    locationName: "klunkerkranich",
    ...overrides,
  })

/** Requests a signed-out visitor may make: the public ones, with no token. */
function watchSignedOutCalls(page: Page): string[] {
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

test.describe("a flare's invite link, signed out", () => {
  test("shows who invited them, then 'i'm in' → sign up → redeemed → the flare", async ({
    page,
  }) => {
    await stubBackend(page, {
      signedOut: true,
      events: [flare({ locationAddress: ADDRESS })],
    })
    const calls = await stubFlareInvite(page, {
      redeem: { state: "going", eventId: EVENT_ID },
    })
    const offending = watchSignedOutCalls(page)

    await page.goto(`/f/${INVITE_TOKEN}`)

    await expect(page.getByText("patrick invited you")).toBeVisible()
    await expect(page.getByText("drinks at klunkerkranich")).toBeVisible()
    await expect(page.getByText(/ · klunkerkranich$/)).toBeVisible()
    // Not the address, the guests or the updates: those come after joining.
    await expect(page.getByText(ADDRESS)).toHaveCount(0)
    await expect(page.getByText("going")).toHaveCount(0)
    expect(offending).toEqual([])

    await page.getByRole("link", { name: "i'm in" }).click()
    await expect(page).toHaveURL(
      `/register?redirectTo=${encodeURIComponent(`/f/${INVITE_TOKEN}?in=1`)}`
    )
    await expect(page.getByText("join Patrick Caire on sponti")).toBeVisible()

    await page.getByLabel("your name").fill("Anna")
    await page.getByLabel("username").fill("anna")
    await page.getByLabel("email").fill("anna@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /create account/i }).click()

    await expect(page).toHaveURL(`/?flare=${EVENT_ID}`)
    await expect(
      drawer(page).locator("h2:not(.sr-only)", {
        hasText: "drinks at klunkerkranich",
      })
    ).toBeVisible()
    // Redeemed once, with the new session, as soon as they were signed in.
    expect(calls.redeems).toHaveLength(1)
    expect(calls.redeems[0].body).toEqual({ token: INVITE_TOKEN })
    expect(calls.redeems[0].auth).toBe("Bearer e2e-access-token")
    // The preview, before sign-up, went out without a token.
    expect(calls.previews[0].auth).toBeNull()
  })

  test("an existing account signs in and comes back to the link", async ({
    page,
  }) => {
    await stubBackend(page, { signedOut: true, events: [flare()] })
    const calls = await stubFlareInvite(page, {
      redeem: { state: "going", eventId: EVENT_ID },
    })

    await page.goto(`/f/${INVITE_TOKEN}`)
    await page.getByRole("link", { name: "i already have an account" }).click()
    await expect(page).toHaveURL(
      `/login?redirectTo=${encodeURIComponent(`/f/${INVITE_TOKEN}?in=1`)}`
    )
    await page.getByLabel("email").fill("anna@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /sign in/i }).click()

    await expect(page).toHaveURL(`/?flare=${EVENT_ID}`)
    expect(calls.redeems).toHaveLength(1)
  })

  test("a link that no longer works says so and offers no way in", async ({
    page,
  }) => {
    await stubBackend(page, { signedOut: true })
    await stubFlareInvite(page, { preview: null })

    await page.goto(`/f/${INVITE_TOKEN}`)

    await expect(page.getByText("link unavailable")).toBeVisible()
    await expect(page.getByRole("link", { name: "i'm in" })).toHaveCount(0)
  })
})

test.describe("a flare's invite link, signed in", () => {
  test("an invite-only flare waits for the host and shows nothing private", async ({
    page,
  }) => {
    await stubBackend(page, {
      events: [flare({ visibility: "private", locationAddress: ADDRESS })],
    })
    const calls = await stubFlareInvite(page, {
      redeem: { state: "waiting", eventId: null },
    })

    await page.goto(`/f/${INVITE_TOKEN}`)
    // Asked first: a signed-in visitor opening the link joins nothing yet.
    await expect(page.getByRole("button", { name: "i'm in" })).toBeVisible()
    expect(calls.redeems).toHaveLength(0)

    await page.getByRole("button", { name: "i'm in" }).click()

    await expect(page.getByText("waiting for patrick to accept")).toBeVisible()
    await expect(page.getByText("drinks at klunkerkranich")).toBeVisible()
    await expect(page.getByText(ADDRESS)).toHaveCount(0)
    await expect(page).toHaveURL(`/f/${INVITE_TOKEN}`)
  })

  test("once the host has accepted, the same link opens the flare", async ({
    page,
  }) => {
    await stubBackend(page, { events: [flare({ visibility: "private" })] })
    await stubFlareInvite(page, {
      status: { state: "invited", eventId: EVENT_ID },
    })

    await page.goto(`/f/${INVITE_TOKEN}`)

    await expect(page).toHaveURL(`/?flare=${EVENT_ID}`)
  })
})

// A phone's share sheet, or a browser without one.
async function stubShareSheet(page: Page, options: { native: boolean }) {
  await page.addInitScript((native) => {
    const w = window as unknown as {
      __shares: unknown[]
      __copied: string[]
    }
    w.__shares = []
    w.__copied = []
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: native
        ? (data: unknown) => {
            w.__shares.push(data)
            return Promise.resolve()
          }
        : undefined,
    })
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          w.__copied.push(text)
          return Promise.resolve()
        },
      },
    })
  }, options.native)
}

const hosted = () =>
  flare({
    hostId: STUB_USER.id,
    visibility: "private",
    startAt: new Date(Date.now() + 26 * 3_600_000).toISOString(),
    endAt: new Date(Date.now() + 29 * 3_600_000).toISOString(),
  })

test.describe("the host's invite button", () => {
  test("opens the share sheet with the message and the flare's own link", async ({
    page,
  }) => {
    await stubShareSheet(page, { native: true })
    await stubBackend(page, { events: [hosted()] })
    const calls = await stubFlareInvite(page)

    await page.goto(`/event/${EVENT_ID}`)
    const invite = drawer(page).getByRole("button", { name: "invite" })
    await expect(invite).toBeEnabled()
    // Fetched before the tap, so the share sheet opens inside the gesture.
    expect(new Set(calls.hostLinkReads)).toEqual(new Set([EVENT_ID]))

    await invite.click()

    const shares = await page.evaluate(
      () => (window as unknown as { __shares: unknown[] }).__shares
    )
    expect(shares).toHaveLength(1)
    const [shared] = shares as Array<{ text: string; url: string }>
    expect(shared.url).toBe(`${new URL(page.url()).origin}/f/${INVITE_TOKEN}`)
    // Read in another app, so a normal sentence with the full date (#621).
    expect(shared.text).toMatch(
      /^Flare invited you to drinks at klunkerkranich on \w+day, /
    )
  })

  test("copies the link and says so when there is no share sheet", async ({
    page,
  }) => {
    await stubShareSheet(page, { native: false })
    await stubBackend(page, { events: [hosted()] })
    await stubFlareInvite(page)

    await page.goto(`/event/${EVENT_ID}`)
    const invite = drawer(page).getByRole("button", { name: "invite" })
    await expect(invite).toBeEnabled()
    await invite.click()

    await expect(page.getByText("link copied")).toBeVisible()
    const copied = await page.evaluate(
      () => (window as unknown as { __copied: string[] }).__copied
    )
    expect(copied).toEqual([`${new URL(page.url()).origin}/f/${INVITE_TOKEN}`])
  })

  test("is the host's alone", async ({ page }) => {
    await stubBackend(page, {
      events: [flare({ visibility: "public", myRsvp: "invited" })],
    })
    const calls = await stubFlareInvite(page)

    await page.goto(`/event/${EVENT_ID}`)

    await expect(
      drawer(page).locator("h2:not(.sr-only)", {
        hasText: "drinks at klunkerkranich",
      })
    ).toBeVisible()
    await expect(
      drawer(page).getByRole("button", { name: "invite" })
    ).toHaveCount(0)
    expect(calls.hostLinkReads).toEqual([])
  })

  test("reset link, on the edit page, asks first and then replaces the link", async ({
    page,
  }) => {
    await stubBackend(page, { events: [hosted()] })
    const calls = await stubFlareInvite(page)

    await page.goto(`/event/${EVENT_ID}/edit`)
    await page.getByRole("button", { name: "reset link" }).click()
    // Nothing is replaced until they confirm.
    expect(calls.hostLinkResets).toEqual([])
    await expect(page.getByText("reset the invite link?")).toBeVisible()

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "reset link" })
      .click()

    await expect(
      page.getByText("new link ready. the old one no longer works.")
    ).toBeVisible()
    expect(calls.hostLinkResets).toEqual([EVENT_ID])
  })
})

// The link preview card is made on the server, which these specs can't stub
// (page.route only sees the browser), and the stubbed api isn't a real host.
// So here every link is one that can't be previewed: it must keep the site's
// generic card, stay out of search, and its image must go to the generic one.
// The card of a live link is covered by app/f/[token]/*.test.ts.
test.describe("a flare invite link's preview card", () => {
  test("falls back to the generic card for a link that can't be previewed", async ({
    page,
  }) => {
    const html = await (await page.request.get(`/f/${INVITE_TOKEN}`)).text()

    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/)
    expect(html).toMatch(/<meta property="og:title" content="sponti"/)
    expect(html).not.toContain(`/f/${INVITE_TOKEN}/og`)
  })

  test("sends its image to the generic one", async ({ page }) => {
    const response = await page.request.get(`/f/${INVITE_TOKEN}/og`, {
      maxRedirects: 0,
    })

    expect(response.status()).toBe(307)
    expect(response.headers()["location"]).toMatch(/\/opengraph-image\.jpg$/)
  })
})
