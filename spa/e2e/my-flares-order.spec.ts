import { expect, test } from "@playwright/test"
import { makeStubFlare, STUB_USER, stubBackend } from "./support/stubs"

// #581: my flares lists live flares first (newest on top), then upcoming
// ones (soonest first). Cancelled flares fold under "show N cancelled".

const min = (m: number) => new Date(Date.now() + m * 60_000).toISOString()
const mine = (id: string, title: string, start: number, end: number) =>
  makeStubFlare({
    _id: id,
    hostId: STUB_USER.id,
    title,
    startAt: min(start),
    endAt: min(end),
  })

test("live newest first, then upcoming, cancelled folded at the bottom", async ({
  page,
}) => {
  await stubBackend(page, {
    hostedFlares: [
      { ...mine("c1", "called off picnic", -90, 60), status: "cancelled" },
      mine("e1", "long lunch", -120, 60),
      mine("e2", "tomorrow hike", 24 * 60, 25 * 60),
      mine("e3", "just lit drinks", -2, 58),
      mine("e4", "later tonight", 180, 240),
    ],
  })
  await page.goto("/event")

  const cards = page.getByRole("link", { name: /^open details for / })
  await expect(cards).toHaveCount(4)
  await expect(cards).toHaveText([
    /just lit drinks/,
    /long lunch/,
    /later tonight/,
    /tomorrow hike/,
  ])

  const fold = page.getByRole("button", { name: "show 1 cancelled" })
  await expect(fold).toBeVisible()
  await expect(page.getByText("called off picnic")).toHaveCount(0)

  await fold.click()
  const row = page.getByRole("link", {
    name: "open details for called off picnic, cancelled",
  })
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute("href", "/event/c1?manage=1")
  await expect(
    page.getByRole("button", { name: "hide 1 cancelled" })
  ).toBeVisible()
})
