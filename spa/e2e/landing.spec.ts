import { expect, test } from "@playwright/test"

// #467 part 1: the sponti.fun landing page, at /landing (the proxy rewrites
// the landing host's "/" to it). Public and outside the app: no session check,
// no api, no mobile gate. playwright.config.ts sets APP_ORIGIN to
// http://app.sponti.test and LANDING_HOSTS to sponti.test.
//
// These start from a device that has not chosen "continue anyway", so the
// desktop run also shows that the mobile gate leaves the landing alone.
test.use({ storageState: { cookies: [], origins: [] } })

const APP_URL = "http://app.sponti.test/"

test.describe("landing page (#467)", () => {
  test("renders the what, why and how, with no app around it", async ({
    page,
  }) => {
    const backendCalls: string[] = []
    page.on("request", (request) => {
      if (/stub-(api|auth)\.sponti\.test/.test(request.url())) {
        backendCalls.push(request.url())
      }
    })

    await page.goto("/landing")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "plans with friends, right now or soon",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "we're more connected than ever, and more alone",
      })
    ).toBeAttached()
    await expect(
      page.getByRole("link", { name: "who commission on social connection" })
    ).toHaveAttribute("href", /who\.int/)
    await expect(
      page.getByRole("heading", { name: "light a flare" })
    ).toBeAttached()
    const steps = page.locator("[data-landing-part='how'] ol > li")
    await expect(steps).toHaveCount(3)
    await expect(steps.nth(1)).toContainText("friends see it")
    await expect(steps.nth(2)).toContainText("they join")

    // Not the app: no mobile gate, no nav, no backend.
    await expect(page.locator("[data-mobile-gate]")).toHaveCount(0)
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(
      0
    )
    await expect(page).toHaveURL(/\/landing$/)
    expect(backendCalls).toEqual([])
  })

  test("'open sponti' is the one call to action and goes to the app", async ({
    page,
  }) => {
    await page.goto("/landing")
    const cta = page.getByRole("link", { name: "open sponti" })
    await expect(cta).toHaveCount(1)
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute("href", APP_URL)
  })

  test("desktop: a qr code of the app sits under the call to action", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop qr")
    await page.goto("/landing")
    const qr = page.getByRole("img", { name: "qr code to open sponti" })
    await expect(qr).toBeVisible()
    await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/)
    await expect(qr).toHaveAttribute("data-qr-target", APP_URL)
    await expect(page.getByText("made for your phone")).toBeVisible()
  })

  test("phone: no qr code", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone project")
    await page.goto("/landing")
    await expect(page.locator("[data-landing-qr]")).toBeHidden()
    await expect(page.getByText("made for your phone")).toBeHidden()
  })

  test("the legal links open the legal pages", async ({ page }) => {
    await page.goto("/landing")
    const legal = page.getByRole("navigation", { name: "legal" })
    await expect(
      legal.getByRole("link", { name: "impressum" })
    ).toHaveAttribute("href", "/menu/impressum")
    await expect(legal.getByRole("link", { name: "terms" })).toHaveAttribute(
      "href",
      "/menu/terms"
    )
    await legal.getByRole("link", { name: "privacy" }).click()
    await expect(page).toHaveURL(/\/menu\/privacy$/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })
})

test.describe("landing host routing (#467)", () => {
  // The browser can't set Host, so these ask the dev server directly.
  const HOST = { host: "sponti.test" }

  test("the landing host's / is the landing page", async ({ request }) => {
    const response = await request.get("/", { headers: HOST, maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain("data-landing-cta")
  })

  test("the landing host serves the legal pages", async ({ request }) => {
    const response = await request.get("/menu/impressum", {
      headers: HOST,
      maxRedirects: 0,
    })
    expect(response.status()).toBe(200)
  })

  test("other paths on the landing host go to the app, path and query kept", async ({
    request,
  }) => {
    const response = await request.get("/invite/abc_123?ref=chat", {
      headers: HOST,
      maxRedirects: 0,
    })
    expect(response.status()).toBe(307)
    expect(response.headers()["location"]).toBe(
      "http://app.sponti.test/invite/abc_123?ref=chat"
    )
  })

  test("the app's own host is untouched", async ({ request }) => {
    const response = await request.get("/login", { maxRedirects: 0 })
    expect(response.status()).toBe(200)
  })
})
