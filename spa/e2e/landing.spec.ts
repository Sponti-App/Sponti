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
        name: "come together, right now.",
      })
    ).toBeVisible()
    // The typewriter's heading reads as its first plan for screen readers.
    await expect(
      page.getByRole("heading", { name: "six apps to plan one beer" })
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
    // The rest of the app, one feature at a time, dark mode last.
    const features = page.locator("[data-landing-feature]")
    await expect(features).toHaveCount(6)
    await expect(
      page.getByRole("heading", { name: "your people, grouped your way." })
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
      page.getByRole("img", { name: /friends on a berlin rooftop at dusk/ })
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

  test("the testing note sits under the hero's call to action", async ({
    page,
  }) => {
    await page.goto("/landing")
    const notes = page.locator("[data-testing-note]")
    await expect(notes).toHaveCount(1)
    await expect(notes).toBeVisible()
    await expect(notes).toContainText("early testing in berlin")
    const cta = page.getByRole("link", { name: "open sponti" }).nth(1)
    const ctaBox = await cta.boundingBox()
    const noteBox = await notes.boundingBox()
    expect(noteBox!.y).toBeGreaterThan(ctaBox!.y + ctaBox!.height - 1)
  })

  test("the footer's waitlist signs up through formspree, with a mail link to say hi", async ({
    page,
  }) => {
    let posted: unknown = null
    await page.route("https://formspree.io/**", async (route) => {
      posted = route.request().postDataJSON()
      await route.fulfill({ json: { ok: true } })
    })
    await page.goto("/landing")
    const footer = page.locator("footer")
    await expect(
      footer.getByRole("link", { name: /say hi: hello@sponti\.fun/ })
    ).toHaveAttribute("href", "mailto:hello@sponti.fun")
    await footer.getByLabel("your email").fill("someone@example.com")
    await footer.getByRole("button", { name: "keep me posted" }).click()
    await expect(footer.getByRole("status")).toContainText("you're on the list")
    expect(posted).toEqual({ email: "someone@example.com", source: "landing" })
  })

  test("the waitlist says so when the sign-up fails", async ({ page }) => {
    await page.route("https://formspree.io/**", (route) =>
      route.fulfill({ status: 500, json: {} })
    )
    await page.goto("/landing")
    const footer = page.locator("footer")
    await footer.getByLabel("your email").fill("someone@example.com")
    await footer.getByRole("button", { name: "keep me posted" }).click()
    await expect(footer.getByRole("alert")).toContainText("didn't go through")
    await expect(footer.getByLabel("your email")).toBeVisible()
  })

  test("desktop: 'open sponti' reveals a qr code instead of navigating", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the desktop reveal")
    await page.goto("/landing")
    const ctas = page.getByRole("link", { name: "open sponti" })
    // Collapsed, the qr's `visibility: hidden` takes it out of the
    // accessibility tree, so the plain img (not its role) finds both.
    const qrImages = page.locator('img[alt="qr code to open sponti"]')
    await expect(qrImages).toHaveCount(2)
    for (const q of await qrImages.all()) await expect(q).toBeHidden()

    // The hero's (index 1): hidden behind the button until it's clicked.
    const hero = ctas.nth(1)
    await expect(hero).toHaveAttribute("aria-expanded", "false")
    await hero.click()
    await expect(page).toHaveURL(/\/landing$/)
    await expect(hero).toHaveAttribute("aria-expanded", "true")
    const qr = page.getByRole("img", { name: "qr code to open sponti" })
    await expect(qr.first()).toBeVisible()
    await expect(qr.first()).toHaveAttribute("src", /^data:image\/png;base64,/)
    await expect(qr.first()).toHaveAttribute("data-qr-target", APP_URL)
    await expect(page.getByText("made for your phone").first()).toBeVisible()

    // Clicking again hides it.
    await hero.click()
    await expect(qrImages.first()).toBeHidden()
  })

  test("phone: 'open sponti' goes straight to the app, no qr code", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the phone project")
    await page.goto("/landing")
    for (const qr of await page.locator("[data-landing-qr]").all()) {
      await expect(qr).toBeHidden()
    }
    // A touch device has no desktop reveal to intercept the click.
    await expect(
      page.getByRole("link", { name: "open sponti" }).nth(1)
    ).not.toHaveAttribute("aria-expanded")
  })

  test("reduced motion: every part shows its final state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/landing")

    // Reveals are shown without scrolling to them.
    await expect(
      page.getByRole("heading", { name: "light a flare." })
    ).toHaveCSS("opacity", "1")
    // The flare is lit, the typewriter holds its first plan, and the hero
    // is one screen with no pin to scroll through.
    await expect(page.locator(".lp-orb")).toHaveAttribute("data-lit", "true")
    await expect(page.locator("[data-typewriter]")).toHaveText("beer")
    const hero = page.locator("section[aria-labelledby='landing-title']")
    const height = await hero.evaluate((el) => el.clientHeight)
    expect(height).toBe(page.viewportSize()!.height)
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
    // The footer's one extra: the app's own about page.
    await expect(legal.getByRole("link", { name: "about" })).toHaveAttribute(
      "href",
      "/menu/about-sponti"
    )
    await legal.getByRole("link", { name: "privacy" }).click()
    await expect(page).toHaveURL(/\/menu\/privacy$/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("the footer's about link opens the about page, signed out", async ({
    page,
  }) => {
    await page.goto("/landing")
    await page
      .getByRole("navigation", { name: "legal" })
      .getByRole("link", { name: "about" })
      .click()
    await expect(page).toHaveURL(/\/menu\/about-sponti$/)
    await expect(
      page.getByRole("heading", { level: 1, name: "about sponti" })
    ).toBeVisible()
    await expect(
      page.getByText("sponti does not want your attention")
    ).toBeVisible()
  })

  test("how it works tells it from the host's side, then the guest's", async ({
    page,
  }) => {
    await page.goto("/landing")
    const steps = page.locator("[data-landing-step]")
    const host = page.getByRole("tab", { name: "as a host" })
    const guest = page.getByRole("tab", { name: "as a guest" })

    // The host's three steps come first.
    await expect(host).toHaveAttribute("aria-selected", "true")
    await expect(guest).toHaveAttribute("aria-selected", "false")
    await expect(steps).toHaveCount(3)
    await expect(steps.nth(0)).toContainText("say what you're up to")

    await guest.click()
    await expect(guest).toHaveAttribute("aria-selected", "true")
    await expect(steps).toHaveCount(3)
    await expect(steps.nth(0)).toContainText("check the map or calendar")
    await expect(steps.nth(1)).toContainText("tap and join")
    await expect(steps.nth(2)).toContainText("get the walking route")
    await expect(steps.nth(2)).toContainText("on your way")

    // Arrow keys move between the tabs, back to the host's.
    await guest.press("ArrowLeft")
    await expect(host).toHaveAttribute("aria-selected", "true")
    await expect(host).toBeFocused()
    await expect(steps.nth(0)).toContainText("say what you're up to")
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

  test("the landing host serves the legal pages and about", async ({
    request,
  }) => {
    for (const path of ["/menu/impressum", "/menu/about-sponti"]) {
      const response = await request.get(path, {
        headers: HOST,
        maxRedirects: 0,
      })
      expect(response.status(), path).toBe(200)
    }
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
