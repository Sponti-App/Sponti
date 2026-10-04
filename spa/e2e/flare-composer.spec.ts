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
  // #366: on "pick a time" the wheels sat over their "start"/"end" labels, the
  // selected row drifted off the highlight band and the end wheel showed a
  // gap. Pin the geometry: label above wheel, three rows tall, selected row
  // on the band, for both wheels, including at the end of a list.
  test("pick a time keeps each wheel below its label with the selection centred", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "flare", exact: true }).click()
    await page.getByRole("tab", { name: "pick a time" }).click()

    const wheels = [
      {
        label: "start",
        list: page.getByRole("listbox", { name: "start time" }),
      },
      { label: "end", list: page.getByRole("listbox", { name: "end time" }) },
    ]
    for (const { list } of wheels) await expect(list).toBeVisible()

    const check = async (): Promise<void> => {
      for (const { label, list } of wheels) {
        const labelBox = await page
          .getByText(label, { exact: true })
          .first()
          .boundingBox()
        const wheel = await list.boundingBox()
        const selected = await list
          .locator('[role="option"][aria-selected="true"]')
          .boundingBox()
        expect(labelBox).not.toBeNull()
        expect(wheel).not.toBeNull()
        expect(selected).not.toBeNull()
        // The label sits wholly above the wheel.
        expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(wheel!.y + 1)
        // Three 36px rows, with the selected one on the middle row.
        expect(wheel!.height).toBeCloseTo(108, 0)
        const wheelMid = wheel!.y + wheel!.height / 2
        expect(selected!.y + selected!.height / 2).toBeCloseTo(wheelMid, 0)
      }
    }

    await expect(async () => {
      await check()
    }).toPass()

    // Run each wheel to its last option, where the list has one empty slot
    // below the selection by design, and check nothing else moves.
    for (const { list } of wheels) {
      await list.evaluate((el) => {
        el.scrollTo({ top: el.scrollHeight })
      })
    }
    await expect(async () => {
      await check()
    }).toPass()
  })
})
