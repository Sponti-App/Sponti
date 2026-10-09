import { expect, test, type Locator, type Page } from "@playwright/test"
import {
  BERLIN_COORDS,
  STUB_USER,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "./support/stubs"

// #315: every flare pin is one circle with its category icon, filled by who
// can join (plum for invite only, teal for open to all). Peach on a pin means
// live only. The e2e app has no Google Maps key, so these run against the
// static fallback map, which draws the same pins and popover.
const NOW = "2026-06-15T12:00:00.000Z" // 14:00 in berlin
const at = (iso: string) => new Date(iso).toISOString()
const point = (lng: number, lat: number) => ({
  type: "Point" as const,
  coordinates: [lng, lat] as [number, number],
})

const MIA = { _id: "user-mia", username: "mia", displayName: "mia lang" }

const INVITE_LIVE = makeStubFlare({
  _id: "e-invite-live",
  hostId: MIA,
  title: "drinks at klunkerkranich",
  type: "drinks",
  visibility: "private",
  startAt: at("2026-06-15T11:50:00.000Z"),
  endAt: at("2026-06-15T13:10:00.000Z"),
  location: point(13.3801, 52.5512),
  goingCount: 6,
})
const JOINED = makeStubFlare({
  _id: "e-joined",
  hostId: { _id: "user-sam", displayName: "sam" },
  title: "sketching in the park",
  type: "hobby",
  visibility: "public",
  startAt: at("2026-06-15T11:30:00.000Z"),
  endAt: at("2026-06-15T13:30:00.000Z"),
  location: point(13.3951, 52.5431),
  myRsvp: "going",
})
const OPEN_SOON = makeStubFlare({
  _id: "e-open-soon",
  hostId: { _id: "user-ana", displayName: "ana" },
  title: "museum late",
  type: "culture",
  visibility: "public",
  startAt: at("2026-06-15T17:00:00.000Z"), // 7pm in berlin
  endAt: at("2026-06-15T19:00:00.000Z"),
  location: point(13.3712, 52.5389),
})
const OWN = makeStubFlare({
  _id: "e-own",
  hostId: { _id: STUB_USER.id, displayName: STUB_USER.displayName },
  title: "coffee walk",
  type: "hangout",
  visibility: "private",
  startAt: at("2026-06-15T11:45:00.000Z"),
  endAt: at("2026-06-15T12:45:00.000Z"),
  location: point(13.3998, 52.5502),
})

test.use({ timezoneId: "Europe/Berlin", locale: "en-US" })

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const pin = (page: Page, id: string) => page.locator(`[data-flare-pin="${id}"]`)
const circle = (page: Page, id: string) =>
  pin(page, id).locator("[data-pin-circle]")
const chip = (page: Page, id: string) =>
  pin(page, id).locator("[data-pin-chip]")
const legend = (page: Page) => page.locator("[data-map-legend]")
const popover = (page: Page) => page.locator("[data-flare-preview]")

async function openMap(page: Page, mapEvents: StubApiEvent[]) {
  await page.clock.setFixedTime(NOW)
  await stubBackend(page, { mapEvents, coords: BERLIN_COORDS })
  await page.goto("/")
  await expect(nav(page)).toBeVisible()
}

/** A CSS colour token resolved the way the browser paints it. */
async function tokenColor(
  page: Page,
  token: string,
  prop: "color" | "backgroundColor" = "backgroundColor"
) {
  return page.evaluate(
    ({ token, prop }) => {
      const probe = document.createElement("span")
      probe.style[prop] = `var(${token})`
      document.body.appendChild(probe)
      const value = getComputedStyle(probe)[prop]
      probe.remove()
      return value
    },
    { token, prop }
  )
}

const style = (el: Locator) =>
  el.evaluate((node) => {
    const cs = getComputedStyle(node)
    return {
      background: cs.backgroundColor,
      border: cs.borderTopColor,
      boxShadow: cs.boxShadow,
    }
  })

/** The smallest font size of any text inside the element. */
const smallestText = (el: Locator) =>
  el.evaluate((root) => {
    let min = Infinity
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!node.textContent?.trim() || !node.parentElement) continue
      const size = parseFloat(getComputedStyle(node.parentElement).fontSize)
      min = Math.min(min, size)
    }
    return min
  })

test.describe("map flare pins (#315)", () => {
  test("the fill says who can join, and no pin has a peach border", async ({
    page,
  }) => {
    await openMap(page, [INVITE_LIVE, JOINED, OPEN_SOON, OWN])
    const invite = await tokenColor(page, "--flare-invite")
    const open = await tokenColor(page, "--flare-open")
    const accent = await tokenColor(page, "--accent")
    expect(invite).not.toBe(open)

    const inviteStyle = await style(circle(page, INVITE_LIVE._id))
    const openStyle = await style(circle(page, OPEN_SOON._id))
    expect(inviteStyle.background).toBe(invite)
    expect(openStyle.background).toBe(open)
    expect(inviteStyle.border).not.toBe(accent)
    expect(openStyle.border).not.toBe(accent)
    await expect(pin(page, INVITE_LIVE._id)).toHaveAttribute(
      "data-visibility",
      "private"
    )
  })

  test("a live pin has the peach ring and a live chip; a soon pin shows its time", async ({
    page,
  }) => {
    await openMap(page, [INVITE_LIVE, JOINED, OPEN_SOON, OWN])

    await expect(chip(page, INVITE_LIVE._id)).toHaveText("live")
    await expect(
      pin(page, INVITE_LIVE._id).locator(".animate-pulse-ring")
    ).toHaveCount(1)
    const accent = await tokenColor(page, "--accent", "color")
    const live = await style(circle(page, INVITE_LIVE._id))
    // The ring is a box-shadow in the accent colour.
    expect(live.boxShadow).toContain(accent)

    await expect(chip(page, OPEN_SOON._id)).toHaveText("7pm")
    await expect(
      pin(page, OPEN_SOON._id).locator(".animate-pulse-ring")
    ).toHaveCount(0)
    const soon = await style(circle(page, OPEN_SOON._id))
    expect(soon.boxShadow).not.toContain(accent)
  })

  test("your own flare's chip starts with you, and a joined flare has the check badge", async ({
    page,
  }) => {
    await openMap(page, [INVITE_LIVE, JOINED, OPEN_SOON, OWN])
    await expect(chip(page, OWN._id)).toHaveText("you · live")
    await expect(
      pin(page, JOINED._id).locator("[data-joined-badge]")
    ).toBeVisible()
    await expect(
      pin(page, INVITE_LIVE._id).locator("[data-joined-badge]")
    ).toHaveCount(0)
  })

  test("no text under 12px on pins", async ({ page }) => {
    await openMap(page, [INVITE_LIVE, JOINED, OPEN_SOON, OWN])
    for (const e of [INVITE_LIVE, JOINED, OPEN_SOON, OWN]) {
      expect(await smallestText(pin(page, e._id))).toBeGreaterThanOrEqual(12)
    }
  })

  test("no pin legend under the top bar, with or without pins (#490)", async ({
    page,
  }) => {
    await openMap(page, [INVITE_LIVE, OPEN_SOON])
    await expect(pin(page, INVITE_LIVE._id)).toBeVisible()
    await expect(legend(page)).toHaveCount(0)
    await expect(page.getByText("invite only", { exact: true })).toHaveCount(0)
    await expect(page.getByText("open to all", { exact: true })).toHaveCount(0)
  })

  test("the fallback map labels an untitled flare with its host (#494)", async ({
    page,
  }) => {
    const untitled = makeStubFlare({
      _id: "e-untitled",
      hostId: MIA,
      title: "theater outing",
      type: "culture",
      visibility: "private",
      startAt: at("2026-06-15T11:50:00.000Z"),
      endAt: at("2026-06-15T13:10:00.000Z"),
      location: point(13.3801, 52.5512),
    })
    // Lit before untitled flares got a real title: [type, host, place, when].
    const old = makeStubFlare({
      _id: "e-old",
      hostId: MIA,
      title: "hobby · mia lang · acud theater · mi 7:45pm",
      type: "hobby",
      visibility: "private",
      startAt: at("2026-06-15T11:50:00.000Z"),
      endAt: at("2026-06-15T13:10:00.000Z"),
      location: point(13.4, 52.55),
    })
    await openMap(page, [untitled, old])
    for (const flare of [untitled, old]) {
      const button = page
        .getByRole("button")
        .filter({ has: pin(page, flare._id) })
      await expect(button).toContainText("theater outing with mia")
      await expect(button).not.toContainText("·")
    }
  })
})

test.describe("the pin popover (#315)", () => {
  test("the band shows the category icon and who can join; close sits in it", async ({
    page,
  }) => {
    await openMap(page, [INVITE_LIVE, JOINED, OPEN_SOON, OWN])
    await pin(page, INVITE_LIVE._id).click()

    const card = popover(page)
    await expect(card).toBeVisible()
    const band = card.locator("[data-popover-band]")
    await expect(band).toHaveText(/invite only/)
    await expect(band).not.toContainText("drinks")
    await expect(band.getByRole("img", { name: "drinks" })).toBeVisible()
    expect((await style(band)).background).toBe(
      await tokenColor(page, "--flare-invite")
    )

    await expect(card.getByText("drinks at klunkerkranich")).toBeVisible()
    await expect(card.getByText("live · ends in 1h 10m")).toBeVisible()
    await expect(card.getByText(/^by mia · .* · 6 going$/)).toBeVisible()
    expect(await smallestText(card)).toBeGreaterThanOrEqual(12)

    // Close: at least 40px, centred on the band, flush with its right edge.
    const close = band.getByRole("button", { name: "close" })
    const b = (await band.boundingBox())!
    const c = (await close.boundingBox())!
    expect(c.width).toBeGreaterThanOrEqual(40)
    expect(c.height).toBeGreaterThanOrEqual(40)
    expect(Math.abs(c.y + c.height / 2 - (b.y + b.height / 2))).toBeLessThan(1)
    expect(Math.abs(c.x + c.width - (b.x + b.width))).toBeLessThan(1)

    await close.click()
    await expect(card).toBeHidden()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("an open-to-all popover uses the teal band, and the card opens the flare", async ({
    page,
  }) => {
    await openMap(page, [INVITE_LIVE, JOINED, OPEN_SOON, OWN])
    await pin(page, OPEN_SOON._id).click()

    const card = popover(page)
    const band = card.locator("[data-popover-band]")
    await expect(band).toHaveText(/open to all/)
    expect((await style(band)).background).toBe(
      await tokenColor(page, "--flare-open")
    )
    await expect(card.getByText("starts 7pm")).toBeVisible()

    await card.getByRole("button", { name: "see flare" }).click()
    await expect(card).toBeHidden()
    await expect(page.getByRole("dialog")).toBeVisible()
  })
})

// #364: the pins are the flares the rail and list show. Same chips, same
// live / soon / all tab. The static fallback draws at most 4 pins, so every
// case here stays within 4 flares (the ended one only shows when unfolded).
test.describe("pins follow the filters (#364)", () => {
  const ENDED = makeStubFlare({
    _id: "e-ended",
    hostId: MIA,
    title: "lunch at the market",
    type: "food",
    visibility: "public",
    startAt: at("2026-06-15T09:00:00.000Z"),
    endAt: at("2026-06-15T10:00:00.000Z"),
    location: point(13.3877, 52.5421),
  })
  const ALL = [INVITE_LIVE, JOINED, OPEN_SOON, OWN]
  const dock = (page: Page) => page.locator("[data-map-dock]")
  const typeChip = (page: Page, name: string) =>
    dock(page).getByRole("button", { name, exact: true })
  const pins = (page: Page) => page.locator("[data-flare-pin]")

  test("a category chip takes the other categories' pins off the map", async ({
    page,
  }) => {
    await openMap(page, ALL)
    await expect(pins(page)).toHaveCount(4)

    await typeChip(page, "drinks").click()
    await expect(pins(page)).toHaveCount(1)
    await expect(pin(page, INVITE_LIVE._id)).toBeVisible()

    // A second chip adds its category back; clearing the chips shows all.
    await typeChip(page, "culture").click()
    await expect(pins(page)).toHaveCount(2)
    await expect(pin(page, OPEN_SOON._id)).toBeVisible()
    await typeChip(page, "culture").click()
    await typeChip(page, "drinks").click()
    await expect(pins(page)).toHaveCount(4)
  })

  test("the map has no live / soon / all tabs: now and soon are the views", async ({
    page,
  }) => {
    await openMap(page, ALL)
    await expect(pins(page)).toHaveCount(4)
    await expect(dock(page).getByRole("tab")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "now", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(
      page.getByRole("button", { name: "soon", exact: true })
    ).toHaveAttribute("aria-pressed", "false")
  })

  test("an ended flare has a pin only while the list shows it", async ({
    page,
  }) => {
    await openMap(page, [INVITE_LIVE, OPEN_SOON, ENDED])
    await expect(pins(page)).toHaveCount(2)
    await expect(pin(page, ENDED._id)).toHaveCount(0)

    // Unfold the ended flares in the list, then come back to the map.
    await dock(page).getByRole("button", { name: "list", exact: true }).click()
    const list = page.locator("[data-map-list]")
    await list.getByRole("button", { name: /show 1 ended/ }).click()
    await list.getByRole("button", { name: "map", exact: true }).click()
    await expect(pin(page, ENDED._id)).toBeVisible()
  })

  test("a popover closes when a chip takes its pin away", async ({ page }) => {
    await openMap(page, ALL)
    await pin(page, OPEN_SOON._id).click()
    await expect(popover(page)).toBeVisible()

    await typeChip(page, "drinks").click()
    await expect(pin(page, OPEN_SOON._id)).toHaveCount(0)
    await expect(popover(page)).toBeHidden()
    // It does not come back with the chip off.
    await typeChip(page, "drinks").click()
    await expect(popover(page)).toBeHidden()
  })
})

// #493: the rail's flare cards carry their pin's colour instead of the flat
// card colour: a shade of plum for invite only, of teal for open to all, in
// both modes, with AA text on it. Live keeps the peach left strip.
test.describe("rail cards tinted by who can join (#493)", () => {
  const railCard = (page: Page, id: string) =>
    page
      .getByRole("region", { name: "flares near you" })
      .locator(`[data-rail-id="${id}"]`)

  /** WCAG contrast of the element's text colour on its background. */
  const textContrast = (el: Locator, bg: Locator) =>
    Promise.all([
      el.evaluate((n) => getComputedStyle(n).color),
      bg.evaluate((n) => getComputedStyle(n).backgroundColor),
    ]).then(([fg, back]) =>
      el.page().evaluate(
        ({ fg, back }) => {
          // The canvas turns any CSS colour (oklch included) into sRGB.
          const ctx = document.createElement("canvas").getContext("2d")!
          const lum = (color: string) => {
            ctx.clearRect(0, 0, 1, 1)
            ctx.fillStyle = color
            ctx.fillRect(0, 0, 1, 1)
            const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data)
            const lin = (c: number) => {
              const v = c / 255
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
            }
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
          }
          const [a, b] = [lum(fg), lum(back)]
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        },
        { fg, back }
      )
    )

  for (const colorScheme of ["light", "dark"] as const) {
    test(`invite only is plum, open to all is teal, text is AA (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme })
      await openMap(page, [INVITE_LIVE, OPEN_SOON])

      const invite = railCard(page, INVITE_LIVE._id)
      const open = railCard(page, OPEN_SOON._id)
      await expect(invite).toHaveAttribute("data-visibility", "private")
      await expect(open).toHaveAttribute("data-visibility", "public")

      const [inviteTint, openTint, card] = await Promise.all([
        tokenColor(page, "--flare-invite-tint"),
        tokenColor(page, "--flare-open-tint"),
        tokenColor(page, "--card"),
      ])
      expect(inviteTint).not.toBe(openTint)
      expect((await style(invite)).background).toBe(inviteTint)
      expect((await style(open)).background).toBe(openTint)
      expect((await style(invite)).background).not.toBe(card)

      // The icon sits in the pin's own fill.
      expect((await style(invite.locator("[data-rail-icon]"))).background).toBe(
        await tokenColor(page, "--flare-invite")
      )
      expect((await style(open.locator("[data-rail-icon]"))).background).toBe(
        await tokenColor(page, "--flare-open")
      )

      // Title and meta line, AA for normal text.
      for (const c of [invite, open]) {
        for (const text of await c.locator("p").all()) {
          expect(await textContrast(text, c)).toBeGreaterThanOrEqual(4.5)
        }
      }

      // Live keeps its peach strip; a soon card has none.
      const accent = await tokenColor(page, "--accent", "color")
      const leftBorder = (el: Locator) =>
        el.evaluate((n) => getComputedStyle(n).borderLeftColor)
      expect(await leftBorder(invite)).toBe(accent)
      expect(await leftBorder(open)).not.toBe(accent)
    })
  }
})
