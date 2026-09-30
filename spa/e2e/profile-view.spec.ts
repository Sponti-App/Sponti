import { expect, test } from "@playwright/test"
import {
  STUB_USER,
  stubBackend,
  type StubProfileIdentity,
  type StubUserProfile,
} from "./support/stubs"

// #289: the profile view. What the api sends for each kind of viewer (#288)
// decides what is drawn; hidden fields arrive empty and leave no trace.

const person = (
  username: string,
  displayName: string
): StubProfileIdentity => ({
  id: `user-e2e-${username}`,
  username,
  displayName,
  avatarUrl: null,
})

const MAYA = person("maya", "Maya Chen")
const NOAH = person("noah", "Noah Weiss")
const ADA = person("ada", "Ada Okafor")
const LEO = person("leo", "Leo Martin")

const sarah = person("sarah", "Sarah Kim")

const connectionProfile: StubUserProfile = {
  profile: {
    ...sarah,
    bio: "climbing, coffee, late dinners",
    socials: { instagram: "sarah.kim", telegram: "sarahk" },
  },
  relationship: "connected",
  connectionId: null,
  mutualFriends: { count: 4, preview: [ADA, LEO, MAYA] },
}

// A stranger on a private profile: the api answers as if the owner left
// everything empty.
const hiddenProfile: StubUserProfile = {
  profile: sarah,
  relationship: "none",
  connectionId: null,
}

const ownProfile: StubUserProfile = {
  profile: {
    id: STUB_USER.id,
    username: STUB_USER.username,
    displayName: STUB_USER.displayName,
    avatarUrl: null,
    bio: "lighting flares on weeknights",
    socials: { instagram: "flaretester", telegram: null },
  },
  relationship: "self",
  connectionId: null,
  mutualFriends: { count: 0, preview: [] },
}

test.describe("profile view (#289)", () => {
  test("a connection's profile shows bio, socials and mutual friends", async ({
    page,
  }) => {
    await stubBackend(page, {
      profiles: {
        sarah: connectionProfile,
        maya: { ...hiddenProfile, profile: MAYA },
      },
      mutualFriends: { sarah: [ADA, LEO, MAYA, NOAH] },
    })
    await page.goto("/profile/sarah")

    await expect(page.getByText("climbing, coffee, late dinners")).toBeVisible()
    const instagram = page.getByRole("link", { name: /instagram/ })
    await expect(instagram).toHaveAttribute(
      "href",
      "https://instagram.com/sarah.kim"
    )
    await expect(instagram).toHaveAttribute("target", "_blank")
    await expect(page.getByRole("link", { name: /telegram/ })).toHaveAttribute(
      "href",
      "https://t.me/sarahk"
    )

    await page.getByRole("button", { name: "4 mutual friends" }).click()
    const list = page.getByRole("dialog", { name: "mutual friends" })
    await expect(list.getByRole("link")).toHaveCount(4)

    await list.getByRole("link", { name: /Maya Chen/ }).click()
    await expect(page).toHaveURL(/\/profile\/maya$/)
    await expect(page.getByText("@maya")).toBeVisible()
    await expect(page.getByText("Sarah Kim")).toHaveCount(0)
  })

  test("a stranger on a hidden profile sees the bare card and no hint", async ({
    page,
  }) => {
    await stubBackend(page, { profiles: { sarah: hiddenProfile } })
    await page.goto("/profile/sarah")

    await expect(page.getByText("Sarah Kim")).toBeVisible()
    await expect(page.getByText("@sarah")).toBeVisible()
    await expect(page.getByRole("button", { name: "add friend" })).toBeVisible()
    await expect(
      page.getByRole("link", { name: /instagram|telegram/ })
    ).toHaveCount(0)
    await expect(page.getByText(/mutual|private|bio|friends see/i)).toHaveCount(
      0
    )
  })

  test("your own profile shows the visibility pill and edit profile, not mutual friends", async ({
    page,
  }) => {
    await stubBackend(page, {
      profileVisibility: "private",
      profiles: { [STUB_USER.username]: ownProfile },
    })
    await page.goto(`/profile/${STUB_USER.username}`)

    await expect(page.getByText("private · not in search")).toBeVisible()
    await expect(page.getByText("lighting flares on weeknights")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "edit profile" })
    ).toHaveAttribute("href", "/settings/profile")
    await expect(page.getByText(/mutual/)).toHaveCount(0)
  })
})
