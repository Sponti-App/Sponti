import { expect, test } from "@playwright/test"
import {
  API_BASE,
  AUTH_BASE,
  makeStubFlare,
  stubBackend,
} from "./support/stubs"

// #339: product copy is lowercase, dates and times included. Months, weekdays
// and am/pm come from lib/format-date.ts, so the calendar must show no capital
// letter outside the flare title the host typed.

test.describe("lowercase copy (#339)", () => {
  test("calendar month, day headings and times are lowercase", async ({
    page,
  }) => {
    // A fixed Wednesday, so the flare two days out (Friday) is always in the week
    // strip; "now + 2 days" fell into next week's strip on weekends.
    await page.clock.setFixedTime(new Date(2026, 9, 7, 9, 0))
    await stubBackend(page)
    const startAt = new Date(2026, 9, 9, 13, 24)
    // Registered after the backend stub, so it answers first.
    await page.route(`${API_BASE}/**/events/calendar/upcoming**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            makeStubFlare({
              _id: "event-calendar-1",
              title: "Rooftop Picnic",
              startAt: startAt.toISOString(),
              endAt: new Date(startAt.getTime() + 3_600_000).toISOString(),
            }),
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      })
    )
    await page.goto("/")
    await page.getByRole("button", { name: "calendar" }).click()

    const row = page.getByText(/^1:24\s?pm$/)
    await expect(row).toBeVisible()
    // The host's title keeps its capitals, the shared formatters add none.
    await expect(page.getByText("Rooftop Picnic")).toBeVisible()

    const month = startAt
      .toLocaleDateString(undefined, { month: "long" })
      .toLowerCase()
    await expect(page.getByRole("heading", { name: month })).toBeVisible()
    const dayHeading = startAt
      .toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
      .toLowerCase()
    // The week strip's day button, and the agenda's heading for that day.
    await expect(
      page.getByRole("button", { name: dayHeading, exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: `${dayHeading}1 event`, exact: true })
    ).toBeVisible()
  })

  test("the login page's unexpected-error line is lowercase", async ({
    page,
  }) => {
    // A 200 with no body parses to a session the app can't use, which is the
    // non-HttpError path the page words itself.
    await page.route(`${AUTH_BASE}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      })
    )
    await page.goto("/login")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("hunter2hunter2")
    await page.getByRole("button", { name: "sign in" }).click()
    await expect(
      page.getByText("something went wrong, try again")
    ).toBeVisible()
  })

  test("the google button's fallback is lowercase", async ({ page }) => {
    await page.goto("/login")
    await expect(
      page.getByRole("button", { name: "google sign-in is not configured" })
    ).toBeVisible()
  })
})
