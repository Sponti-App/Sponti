import { expect, test } from "@playwright/test"
import { API_BASE, makeStubFlare, stubBackend } from "./support/stubs"

const TITLE_PLACEHOLDER = "what's the plan? e.g. drinks after work"

test.describe("flare composer", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page)
    await page.goto("/")
    // AuthGate shows a spinner until the stubbed /auth/me resolves and the
    // authenticated chrome (incl. BottomNav) mounts.
    await expect(
      page.getByRole("navigation", { name: "Primary" })
    ).toBeVisible()
  })

  test("opens from the bottom nav with the title input and CTA in view", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "flare", exact: true }).click()

    const titleInput = page.getByPlaceholder(TITLE_PLACEHOLDER)
    const cta = page.getByRole("button", { name: "light a flare", exact: true })

    await expect(titleInput).toBeInViewport()
    await expect(cta).toBeInViewport()
  })

  test("opens from the map FAB with the title input and CTA in view", async ({
    page,
  }) => {
    // The map opens at mid, where the nav's flare button stands in for the
    // FAB; the FAB shows at peek (#223).
    await page.getByRole("button", { name: "hide cards" }).click()
    await page
      .getByRole("button", { name: "Light a flare", exact: true })
      .click()

    const titleInput = page.getByPlaceholder(TITLE_PLACEHOLDER)
    const cta = page.getByRole("button", { name: "light a flare", exact: true })

    await expect(titleInput).toBeInViewport()
    await expect(cta).toBeInViewport()
  })

  test("closing the composer restores nav interactivity and navigation", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "flare", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE_PLACEHOLDER)).toBeInViewport()

    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByPlaceholder(TITLE_PLACEHOLDER)).toBeHidden()

    // vaul/Radix's Dialog primitive locks the body (pointer-events: none)
    // while the drawer is open/animating out. If it never gets unlocked, the
    // whole app becomes unclickable behind an invisible drawer.
    await expect(async () => {
      const pointerEvents = await page.evaluate(
        () => document.body.style.pointerEvents
      )
      expect(pointerEvents === "" || pointerEvents === "auto").toBe(true)
    }).toPass()

    await page.getByRole("button", { name: "my flares", exact: true }).click()
    await expect(page).toHaveURL(/\/event$/)
  })

  // #312: "right now" can start a little later.
  test("lights a flare that starts in 30 minutes", async ({
    page,
    context,
  }) => {
    // "my location" needs a granted position before the flare can light.
    await context.grantPermissions(["geolocation"])
    await context.setGeolocation({ latitude: 37.7749, longitude: -122.4194 })
    await page.getByRole("button", { name: "flare", exact: true }).click()
    await page.getByPlaceholder(TITLE_PLACEHOLDER).fill("park in a bit")

    await page.getByRole("button", { name: "now · 1h" }).click()
    const starts = page.getByRole("group", { name: "starts" })
    await starts.getByRole("button", { name: "30m" }).click()
    await expect(
      page.getByRole("button", { name: "in 30m · 1h" })
    ).toBeVisible()

    const posted = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        new URL(req.url()).pathname.endsWith("/events")
    )
    const before = Date.now()
    await page
      .getByRole("button", { name: "light a flare", exact: true })
      .click()
    const body = (await posted).postDataJSON() as {
      startAt: string
      endAt: string
    }
    const start = Date.parse(body.startAt)
    const MIN = 60_000
    expect(start - before).toBeGreaterThanOrEqual(30 * MIN - 1_000)
    expect(start - Date.now()).toBeLessThanOrEqual(30 * MIN)
    expect(Date.parse(body.endAt) - start).toBe(60 * MIN)
  })

  // #330: a flare lit "in 30m" edits as a right-now flare, with 30m picked.
  test("a flare lit in 30 minutes edits with the 30m start chip", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"])
    await context.setGeolocation({ latitude: 37.7749, longitude: -122.4194 })
    await page.getByRole("button", { name: "flare", exact: true }).click()
    await page.getByPlaceholder(TITLE_PLACEHOLDER).fill("park in a bit")
    await page.getByRole("button", { name: "now · 1h" }).click()
    await page
      .getByRole("group", { name: "starts" })
      .getByRole("button", { name: "30m" })
      .click()

    const posted = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        new URL(req.url()).pathname.endsWith("/events")
    )
    await page
      .getByRole("button", { name: "light a flare", exact: true })
      .click()
    const request = await posted
    const body = request.postDataJSON() as { startAt: string; endAt: string }

    // What the api would hand back for it: the host's own flare, stamped
    // with the server's creation time.
    const lit = {
      ...makeStubFlare({
        _id: "event-e2e-lit",
        hostId: "user-e2e-1",
        title: "park in a bit",
        startAt: body.startAt,
        endAt: body.endAt,
      }),
      createdAt: new Date().toISOString(),
    }
    await page.route(`${API_BASE}/**/events/event-e2e-lit`, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: lit }),
          })
        : route.fallback()
    )

    await page.goto("/event/event-e2e-lit/edit")
    const starts = page.getByRole("group", { name: "starts" })
    await expect(starts.getByRole("button", { name: "30m" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(starts.getByRole("button", { name: "now" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    await expect(page.getByLabel("date")).toHaveCount(0)
    // #340: the composer's "how long?" chips, with the 1h it was lit with.
    const howLong = page.getByRole("group", { name: "how long" })
    await expect(howLong.getByRole("button")).toHaveText([
      "30m",
      "1h",
      "2h",
      "3h",
      "4h",
      "open",
    ])
    await expect(howLong.getByRole("button", { name: "1h" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(
      page.getByRole("button", { name: "no changes yet" })
    ).toBeDisabled()
  })
  // #367: with the keyboard up for the location search, the pinned CTA took
  // half the slot above the keyboard and the suggestions were squeezed to a
  // sliver. Chromium cannot open a real software keyboard, so this fakes the
  // visual viewport the way iOS shrinks it; a real phone is still the final
  // check for the iOS panning side of the issue.
  test("location search with the keyboard up keeps suggestions visible and tappable", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const listeners: Record<string, Array<() => void>> = {}
      const vv = {
        height: window.innerHeight,
        width: window.innerWidth,
        offsetTop: 0,
        offsetLeft: 0,
        pageTop: 0,
        pageLeft: 0,
        scale: 1,
        addEventListener: (type: string, fn: () => void) => {
          ;(listeners[type] ??= []).push(fn)
        },
        removeEventListener: (type: string, fn: () => void) => {
          listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn)
        },
      }
      Object.defineProperty(window, "visualViewport", {
        value: vv,
        configurable: true,
      })
      Object.defineProperty(window, "__openKeyboard", {
        value: (px: number) => {
          vv.height = window.innerHeight - px
          ;(listeners.resize ?? []).forEach((fn) => fn())
        },
        configurable: true,
      })
    })
    await page.route("**/api/places?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestions: [
            { placeId: "p1", label: "Neue Zukunft", address: "Alt-Stralau 68" },
            { placeId: "p2", label: "Neue Heimat", address: "Revaler Str. 99" },
            { placeId: "p3", label: "Neuer See", address: "Tiergarten" },
          ],
        }),
      })
    )
    await page.route("**/api/places/p1", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          placeId: "p1",
          name: "Neue Zukunft",
          address: "Alt-Stralau 68",
          lat: 52.5,
          lng: 13.4,
        }),
      })
    )

    // The init script only applies to the next navigation; beforeEach has
    // already loaded the page once.
    await page.reload()
    await expect(
      page.getByRole("navigation", { name: "Primary" })
    ).toBeVisible()
    await page.getByRole("button", { name: "flare", exact: true }).click()
    await page
      .getByRole("button", { name: /my location/ })
      .first()
      .click()
    await page.getByRole("button", { name: "Search for a place" }).click()
    const input = page.getByPlaceholder("search for a place")
    await input.fill("neue zu")
    await page.evaluate(() => {
      ;(
        window as unknown as { __openKeyboard: (px: number) => void }
      ).__openKeyboard(336)
    })

    const cta = page.getByRole("button", { name: "light a flare", exact: true })
    const first = page.getByRole("button", { name: /Neue Zukunft/ })
    await expect(first).toBeVisible()
    // The CTA steps aside while the keyboard is up...
    await expect(cta).toBeHidden()
    // ...so the first suggestion sits wholly inside the slot above the
    // keyboard, not under anything.
    await expect(async () => {
      const box = await first.boundingBox()
      const viewport = await page.evaluate(() => window.visualViewport!.height)
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport)
    }).toPass()

    // Tapping it picks the place, closes the keyboard and brings the CTA back.
    await first.click()
    await expect(input).not.toBeFocused()
    await expect(cta).toBeVisible()
  })
})
