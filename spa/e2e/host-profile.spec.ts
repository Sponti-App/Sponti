import { expect, test } from "@playwright/test"
import {
  makeStubFlare,
  stubBackend,
  type StubUserProfile,
} from "./support/stubs"

// #199: tapping a flare's host opens their profile, and for a host the
// viewer isn't connected to that profile is real (name, @username, add
// friend), not "user not found". The flare opens in the drawer (#615).

const FLARE_ID = "dddddddddddddddddddddddd"

const HOST = {
  _id: "user-e2e-host",
  username: "sarah",
  displayName: "Sarah Kim",
  avatarUrl: null,
}

const strangerProfile: StubUserProfile = {
  profile: {
    id: HOST._id,
    username: HOST.username,
    displayName: HOST.displayName,
    avatarUrl: null,
  },
  relationship: "none",
  connectionId: null,
}

const flare = () =>
  makeStubFlare({
    _id: FLARE_ID,
    title: "drinks after work",
    hostId: HOST,
  })

test.describe("host profile link (#199)", () => {
  test("from the flare drawer, a stranger host's profile opens with add friend", async ({
    page,
  }) => {
    await stubBackend(page, {
      mapEvents: [flare()],
      profiles: { sarah: strangerProfile },
    })
    await page.goto("/")

    await page
      .getByRole("region", { name: "flares near you" })
      .getByText("drinks after work")
      .click()
    await page
      .locator(`[data-flare-drawer="${FLARE_ID}"]`)
      .getByRole("link", { name: /hosted by sarah kim/ })
      .click()

    await expect(page).toHaveURL(/\/profile\/sarah$/)
    await expect(page.getByText("Sarah Kim")).toBeVisible()
    await expect(page.getByText("@sarah")).toBeVisible()
    await expect(page.getByRole("button", { name: "add friend" })).toBeVisible()
    await expect(page.getByText("user not found")).toHaveCount(0)
  })

  test("from a flare link, the host row opens their profile", async ({
    page,
  }) => {
    await stubBackend(page, {
      events: [flare()],
      profiles: { sarah: strangerProfile },
    })
    await page.goto(`/event/${FLARE_ID}`)

    await page
      .locator(`[data-flare-drawer="${FLARE_ID}"]`)
      .getByRole("link", { name: /hosted by sarah kim/ })
      .click()

    await expect(page).toHaveURL(/\/profile\/sarah$/)
    await expect(page.getByRole("button", { name: "add friend" })).toBeVisible()
  })

  test("a host the api won't show (unknown, or they blocked you) reads as not found", async ({
    page,
  }) => {
    await stubBackend(page)
    await page.goto("/profile/sarah")

    await expect(page.getByText("user not found")).toBeVisible()
    await expect(page.getByRole("button", { name: "add friend" })).toHaveCount(
      0
    )
  })
})
