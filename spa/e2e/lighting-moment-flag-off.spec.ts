import { expect, test } from "@playwright/test"
import { BERLIN_COORDS, stubBackend } from "./support/stubs"

// #376: `flareLightMoment` is off in the tester build, so the composer is
// exactly as before: a "light a flare" button, no strike strip, no morph and
// no lighting moment, just the success toast.

test("with the flag off the composer lights a flare as before", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"])
  await context.setGeolocation({
    latitude: BERLIN_COORDS.lat,
    longitude: BERLIN_COORDS.lng,
  })
  await stubBackend(page, {
    hostedFlares: [],
    friends: 2,
    // #583: with friends, an empty audience asks to pick one instead of
    // lighting, so the friends are in "all friends" as they are in the api.
    circles: [{ _id: "all", name: "all friends", type: "all", memberCount: 2 }],
  })
  await page.goto("/")
  const nav = page.getByRole("navigation", { name: "Primary" })
  await nav.getByRole("button", { name: "flare", exact: true }).click()
  const title = page.getByPlaceholder("what's the plan? e.g. drinks after work")
  await title.fill("park in a bit")

  await expect(page.getByTestId("strike-to-light")).toHaveCount(0)
  await expect(page.locator("[data-flare-morph]")).toHaveCount(0)
  await expect(page.locator("[data-nav-flare-circle]")).not.toHaveAttribute(
    "data-hidden",
    "true"
  )

  await page.getByRole("button", { name: "light a flare" }).click()
  await expect(title).toBeHidden()
  await expect(page.getByText(/light it up/).first()).toBeVisible()
  await expect(page.locator("[data-flare-moment]")).toHaveCount(0)
})
