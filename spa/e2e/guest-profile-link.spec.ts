import { expect, test } from "@playwright/test"
import {
  makeStubFlare,
  STUB_USER,
  stubBackend,
  type StubUserProfile,
} from "./support/stubs"

// #265: a guest in "who's going" opens their profile, the way the host row
// does (#199). Your own row and a guest without a username stay plain. The
// flare opens in the drawer (#615), whose guest list is the flare page's.

const FLARE_ID = "eeeeeeeeeeeeeeeeeeeeeeee"
const drawer = (page: import("@playwright/test").Page) =>
  page.locator(`[data-flare-drawer="${FLARE_ID}"]`)

const HOST = {
  _id: "user-e2e-host",
  username: "sarah",
  displayName: "Sarah Kim",
  avatarUrl: null,
}

const guestProfile: StubUserProfile = {
  profile: {
    id: "user-e2e-maya",
    username: "maya",
    displayName: "Maya Chen",
    avatarUrl: null,
  },
  relationship: "none",
  connectionId: null,
}

// Tapping a guest is a client-side navigation to /profile/[username]. Under
// `next dev` that route compiles on first use (global-setup warms it), and the
// URL only changes once the page's payload arrives, so give it more room than
// the 10s default when the machine is busy (#307).
const NAV = { timeout: 20_000 }

const inMinutes = (min: number) =>
  new Date(Date.now() + min * 60_000).toISOString()

const GUESTS = [
  { _id: "user-e2e-maya", username: "maya", displayName: "Maya Chen" },
  // Your own row: never a link.
  {
    _id: STUB_USER.id,
    username: STUB_USER.username,
    displayName: "Flare Tester",
  },
  // The api sent no username: nowhere to link.
  { _id: "user-e2e-ghost", displayName: "Ghost Guest" },
]

const flare = (hostId: typeof HOST | string = HOST) =>
  makeStubFlare({
    _id: FLARE_ID,
    title: "drinks after work",
    hostId,
    goingCount: GUESTS.length,
    attendees: GUESTS,
  })

test.describe("guest profile link (#265)", () => {
  test("in the flare drawer, a guest opens their profile; you and a username-less guest stay plain", async ({
    page,
  }) => {
    await stubBackend(page, {
      events: [flare()],
      profiles: { maya: guestProfile },
    })
    await page.goto(`/event/${FLARE_ID}`)

    const maya = drawer(page).getByRole("link", {
      name: "maya chen, open profile",
    })
    await expect(maya).toBeVisible()
    // Own row and the username-less guest render, but not as links.
    await expect(drawer(page).getByText("you", { exact: true })).toBeAttached()
    await expect(
      drawer(page).getByText("ghost", { exact: true })
    ).toBeAttached()
    await expect(
      drawer(page).getByRole("link", { name: /flare tester|you, open profile/ })
    ).toHaveCount(0)
    await expect(
      drawer(page).getByRole("link", { name: /ghost guest/ })
    ).toHaveCount(0)
    await expect(
      drawer(page).getByRole("link", { name: /open profile/ })
    ).toHaveCount(
      // the host card link is "hosted by ..." (no aria-label), so only maya
      1
    )

    await maya.click()

    await expect(page).toHaveURL(/\/profile\/maya$/, NAV)
    await expect(page.getByText("Maya Chen")).toBeVisible()
    await expect(page.getByText("@maya")).toBeVisible()
  })

  test("the host's guest list links avatar and name, and keeps the eta column", async ({
    page,
  }) => {
    await stubBackend(page, {
      events: [
        makeStubFlare({
          _id: FLARE_ID,
          title: "drinks after work",
          hostId: STUB_USER.id,
          goingCount: 1,
          startAt: inMinutes(30),
          endAt: inMinutes(150),
          attendees: [
            {
              ...GUESTS[0],
              willArriveAt: inMinutes(45),
              arrivalStatus: null,
            },
          ],
        }),
      ],
      profiles: { maya: guestProfile },
    })
    await page.goto(`/event/${FLARE_ID}`)

    const maya = drawer(page).getByRole("link", {
      name: "maya chen, open profile",
    })
    await expect(maya).toBeAttached()
    // The ETA is beside the link, not part of it.
    const row = drawer(page)
      .getByRole("listitem")
      .filter({
        has: page.getByRole("link", { name: "maya chen, open profile" }),
      })
    await expect(row).toContainText(/\d+ min|\d+:\d+|in /)
    await expect(maya).not.toContainText(/min/)

    await maya.click()
    await expect(page).toHaveURL(/\/profile\/maya$/, NAV)
  })

  test("opened from the map, tapping a guest leaves the drawer for their profile", async ({
    page,
  }) => {
    await stubBackend(page, {
      mapEvents: [flare()],
      profiles: { maya: guestProfile },
    })
    await page.goto("/")

    await page
      .getByRole("region", { name: "flares near you" })
      .getByText("drinks after work")
      .click()
    await expect(drawer(page)).toBeVisible()
    // The host row isn't counted: its link has no "open profile" label.
    await expect(
      drawer(page).getByRole("link", { name: /open profile/ })
    ).toHaveCount(1)

    await drawer(page)
      .getByRole("link", { name: "maya chen, open profile" })
      .click()

    await expect(page).toHaveURL(/\/profile\/maya$/, NAV)
    await expect(drawer(page)).toHaveCount(0)
    await expect(page.getByText("@maya")).toBeVisible()
  })
})
