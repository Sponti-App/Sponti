import { expect, test } from "@playwright/test"
import { STUB_USER, stubBackend } from "./support/stubs"

// #289: bio, Instagram and Telegram are edited on /settings/profile and saved
// through PATCH /auth/me/profile. Handles an older version kept in this
// browser are offered for import once, never imported silently.

const LEGACY_KEY = "sponti.profile.extras.v1"

test.describe("edit profile (#289)", () => {
  test("settings links to the edit page", async ({ page }) => {
    await stubBackend(page)
    await page.goto("/settings")

    await page.getByRole("link", { name: /edit profile/ }).click()

    await expect(page).toHaveURL(/\/settings\/profile$/)
    await expect(page.getByRole("textbox", { name: "bio" })).toBeVisible()
    // The old device-only inputs are gone from settings.
    await page.goBack()
    await expect(page.getByLabel(/instagram/i)).toHaveCount(0)
  })

  test("saves the bio and handles, showing the stored handle for a pasted link", async ({
    page,
  }) => {
    const { profilePatches } = await stubBackend(page)
    await page.goto("/settings/profile")

    const save = page.getByRole("button", { name: "save changes" })
    await expect(page.getByRole("textbox", { name: "bio" })).toBeEnabled()
    await expect(save).toBeDisabled()

    await page.getByRole("textbox", { name: "bio" }).fill("climbing, coffee")
    await expect(page.getByText("16/80")).toBeVisible()
    await page
      .getByRole("textbox", { name: "instagram" })
      .fill("https://www.instagram.com/Sarah.Kim/?igsh=abc")
    await expect(
      page.getByText("shows as @sarah.kim · instagram.com/sarah.kim")
    ).toBeVisible()
    await page.getByRole("textbox", { name: "telegram" }).fill("@SarahKim")

    await save.click()

    await expect(page.getByText("profile saved")).toBeVisible()
    expect(profilePatches).toEqual([
      { bio: "climbing, coffee", instagram: "sarah.kim", telegram: "sarahkim" },
    ])
    await expect(page.getByRole("textbox", { name: "instagram" })).toHaveValue(
      "sarah.kim"
    )
    await expect(save).toBeDisabled()
  })

  test("clearing a saved field sends null", async ({ page }) => {
    const { profilePatches } = await stubBackend(page, {
      ownProfile: { bio: "old bio", instagram: "sarah.kim" },
    })
    await page.goto("/settings/profile")

    const instagram = page.getByRole("textbox", { name: "instagram" })
    await expect(instagram).toHaveValue("sarah.kim")
    await instagram.fill("")
    await page.getByRole("button", { name: "save changes" }).click()

    await expect(page.getByText("profile saved")).toBeVisible()
    expect(profilePatches).toEqual([{ instagram: null }])
  })

  test("explains a bad handle before sending anything", async ({ page }) => {
    const { profilePatches } = await stubBackend(page)
    await page.goto("/settings/profile")

    const telegram = page.getByRole("textbox", { name: "telegram" })
    await expect(telegram).toBeEnabled()
    await telegram.fill("abc")
    await telegram.blur()
    await expect(
      page.getByText(/^telegram handle must be 5–32 letters/)
    ).toBeVisible()
    await page.getByRole("button", { name: "save changes" }).click()
    expect(profilePatches).toEqual([])

    await page.getByRole("textbox", { name: "instagram" }).fill("sarah!!")
    await page.getByRole("textbox", { name: "instagram" }).blur()
    await expect(page.getByText(/^instagram handle must be/)).toBeVisible()
    expect(profilePatches).toEqual([])
  })

  test("offers the handles this device kept, and imports only when asked", async ({
    page,
  }) => {
    const { profilePatches } = await stubBackend(page)
    await page.addInitScript(
      ({ key, userId }) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            [userId]: { instagram: "old.insta", telegram: "oldtelegram" },
          })
        )
      },
      { key: LEGACY_KEY, userId: STUB_USER.id }
    )
    await page.goto("/settings/profile")

    await expect(
      page.getByText("found handles saved on this device")
    ).toBeVisible()
    await expect(page.getByRole("textbox", { name: "instagram" })).toHaveValue(
      ""
    )

    await page.getByRole("button", { name: "add them" }).click()

    await expect(page.getByRole("textbox", { name: "instagram" })).toHaveValue(
      "old.insta"
    )
    expect(profilePatches).toEqual([])
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), LEGACY_KEY)
    ).toBeNull()

    await page.getByRole("button", { name: "save changes" }).click()
    await expect(page.getByText("profile saved")).toBeVisible()
    expect(profilePatches).toEqual([
      { instagram: "old.insta", telegram: "oldtelegram" },
    ])
  })
})
