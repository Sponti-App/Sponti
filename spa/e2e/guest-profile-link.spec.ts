import { expect, test } from "@playwright/test"
import {
  makeStubFlare,
  STUB_USER,
  stubBackend,
  type StubUserProfile,
} from "./support/stubs"

// #265: a guest in "who's going" opens their profile, the way the host row
// does (#199). Your own row and a guest without a username stay plain.

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
    _id: "event-guest-link",
    title: "drinks after work",
    hostId,
    goingCount: GUESTS.length,
    attendees: GUESTS,
  })

test.describe("guest profile link (#265)", () => {
  test("on the flare page, a guest opens their profile; you and a username-less guest stay plain", async ({
    page,
  }) => {
    await stubBackend(page, {
      events: [flare()],
      profiles: { maya: guestProfile },
    })
    await page.goto("/event/event-guest-link")

    const maya = page.getByRole("link", { name: "maya chen, open profile" })
    await expect(maya).toBeVisible()
    // Own row and the username-less guest render, but not as links.
    await expect(page.getByText("you", { exact: true })).toBeVisible()
    await expect(page.getByText("ghost", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("link", { name: /flare tester|you, open profile/ })
    ).toHaveCount(0)
    await expect(page.getByRole("link", { name: /ghost guest/ })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /open profile/ })).toHaveCount(
      // the host card link is "hosted by ..." (no aria-label), so only maya
      1
    )

    await maya.click()

    await expect(page).toHaveURL(/\/profile\/maya$/)
    await expect(page.getByText("Maya Chen")).toBeVisible()
    await expect(page.getByText("@maya")).toBeVisible()
  })

  test("the host's guest list links avatar and name, and keeps the eta column", async ({
    page,
  }) => {
    await stubBackend(page, {
      events: [
        makeStubFlare({
          _id: "event-guest-link",
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
    await page.goto("/event/event-guest-link")

    const maya = page.getByRole("link", { name: "maya chen, open profile" })
    await expect(maya).toBeVisible()
    // The ETA is beside the link, not part of it.
    const row = page.getByRole("listitem").filter({ has: maya })
    await expect(row).toContainText(/\d+ min|\d+:\d+|in /)
    await expect(maya).not.toContainText(/min/)

    await maya.click()
    await expect(page).toHaveURL(/\/profile\/maya$/)
  })

  test("on the map's flare sheet, tapping a guest closes the sheet and opens their profile", async ({
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
    const sheet = page.getByRole("dialog")
    await expect(sheet).toBeVisible()
    // Only guests with somewhere to go are links.
    await expect(sheet.getByRole("link", { name: /open profile/ })).toHaveCount(
      2
    ) // the host row, and maya's name

    await sheet.getByRole("link", { name: "maya chen, open profile" }).click()

    await expect(page).toHaveURL(/\/profile\/maya$/)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText("@maya")).toBeVisible()
  })

  test("on the sheet, the avatar in the stack is a tap shortcut to the same profile", async ({
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
    const sheet = page.getByRole("dialog")
    // Hidden from the accessibility tree: the name link is the accessible one.
    await sheet.locator('a[href="/profile/maya"][aria-hidden="true"]').click()

    await expect(page).toHaveURL(/\/profile\/maya$/)
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })
})
