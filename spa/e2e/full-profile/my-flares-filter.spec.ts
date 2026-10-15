import { expect, test } from "@playwright/test"
import { stubBackend } from "../support/stubs"

// #582: with `myFlaresFilter` (the full profile) the my flares header keeps
// its filter button and menu. The tester build hides them (e2e/my-flares-filter).

test("the full profile keeps the filter button and its menu on my flares", async ({
  page,
}) => {
  await stubBackend(page)
  await page.goto("/event")

  await page.getByRole("button", { name: "filter flares" }).click()
  await expect(page.getByText("sorting hookup pending")).toBeVisible()
})
