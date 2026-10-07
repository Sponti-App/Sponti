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

test.describe("landing page (#467, #506)", () => {
  test("tells the story top to bottom, with no app around it", async ({
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
        name: "turn “we should” into “we're here.”",
      })
    ).toBeVisible()
    // The typewriter's heading reads as its first plan for screen readers.
    await expect(
      page.getByRole("heading", { name: "five apps to plan one beer" })
    ).toBeAttached()
    await expect(
      page.getByRole("heading", { name: "one tap. broadcast or join." })
    ).toBeAttached()
    const steps = page.locator("[data-landing-step]")
    await expect(steps).toHaveCount(3)
    await expect(steps.nth(0)).toContainText("say what you're up to")
    await expect(steps.nth(1)).toContainText("your people see it")
    await expect(steps.nth(2)).toContainText("they tap join")
    await expect(
      page.getByRole("heading", { name: "what's happening now." })
    ).toBeAttached()
    await expect(
      page.getByRole("heading", { name: "easy on the eyes after sunset." })
    ).toBeAttached()
    await expect(
      page.getByRole("heading", {
        name: "more connected than ever, and more alone.",
      })
    ).toBeAttached()
    await expect(
      page.getByRole("link", { name: "who commission on social connection" })
    ).toHaveAttribute("href", /who\.int/)
    await expect(
      page.getByRole("heading", { name: "light a flare." })
    ).toBeAttached()

    // The scenes carry their descriptions.
    await expect(
      page.getByRole("img", { name: /friends on a rooftop at sunset/ })
    ).toBeAttached()

    // Not the app: no mobile gate, no nav, no backend.
    await expect(page.locator("[data-mobile-gate]")).toHaveCount(0)
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(
      0
    )
    await expect(page).toHaveURL(/\/landing$/)
    expect(backendCalls).toEqual([])
  })

  test("every 'open sponti' goes to the app", async ({ page }) => {
    await page.goto("/landing")
    const ctas = page.getByRole("link", { name: "open sponti" })
    await expect(ctas).toHaveCount(3)
    for (const cta of await ctas.all()) {
      await expect(cta).toHaveAttribute("href", APP_URL)
    }
    // The header's and the hero's are on screen right away.
    await expect(ctas.nth(0)).toBeVisible()
    await expect(ctas.nth(1)).toBeVisible()
  })

  test("the testing note sits by the call to action and in the footer", async ({
    page,
  }) => {
    await page.goto("/landing")
    const notes = page.locator("[data-testing-note]")
    await expect(notes).toHaveCount(2)
    await expect(notes.first()).toBeVisible()
    await expect(notes.first()).toContainText("early testing in berlin")
    await expect(
      notes.first().getByRole("link", { name: "hello@sponti.fun" })
    ).toHaveAttribute("href", "mailto:hello@sponti.fun")
    await expect(page.locator("footer [data-testing-note]")).toHaveCount(1)
  })

  test("desktop: a qr code of the app sits by the calls to action", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop qr")
    await page.goto("/landing")
    const qr = page.getByRole("img", { name: "qr code to open sponti" })
    await expect(qr).toHaveCount(2)
    await expect(qr.first()).toBeVisible()
    await expect(qr.first()).toHaveAttribute("src", /^data:image\/png;base64,/)
    await expect(qr.first()).toHaveAttribute("data-qr-target", APP_URL)
    await expect(page.getByText("made for your phone").first()).toBeVisible()
  })

  test("phone: no qr code", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone project")
    await page.goto("/landing")
    for (const qr of await page.locator("[data-landing-qr]").all()) {
      await expect(qr).toBeHidden()
    }
  })

  test("reduced motion: every part shows its final state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/landing")

    // Reveals are shown without scrolling to them.
    await expect(
      page.getByRole("heading", { name: "light a flare." })
    ).toHaveCSS("opacity", "1")
    // The flare is lit, the typewriter holds its first plan, and the dark
    // mode phone rests halfway.
    await expect(page.locator(".lp-orb")).toHaveAttribute("data-lit", "true")
    await expect(page.locator("[data-typewriter]")).toHaveText("beer")
    await expect(
      page.locator("section[aria-labelledby='landing-night']")
    ).toHaveAttribute("style", /--p: 0\.39/)
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
