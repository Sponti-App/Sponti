import { expect, test, type Page } from "@playwright/test"
import {
  BERLIN_COORDS,
  makeStubFlare,
  stubBackend,
  type StubApiEvent,
} from "../support/stubs"

// #459: with `introV2` (the full profile), a new account gets a checklist in
// the map's sheet instead of the first-run intro (#313). Its two rows tick
// off from real data, its button is the friend-count call to action, and an
// account with no friends adds its first friend before a kept draft (#389)
// is lit. The four states are the #373 prototype's: 0 or 3 friends, with the
// first flare lit or not.

// A day when the berlin idea spots are in season.
const JUNE = "2026-06-15T12:00:00.000Z"
const MAYBACH = "market lunch at the maybachufer"

const checklist = (page: Page) =>
  page.getByRole("region", { name: "get going" })
// Under a modal sheet the checklist is aria-hidden, so it has no role there.
const checklistNode = (page: Page) =>
  page.locator("[data-onboarding-checklist]")
const row = (page: Page, which: "flare" | "friend") =>
  checklist(page).locator(`[data-checklist-row="${which}"]`)
const firstFriend = (page: Page) =>
  page.getByRole("dialog", { name: "add your first friend" })
const welcome = (page: Page) => page.locator('[data-sheet="welcome in"]')
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" })
const composerTitle = (page: Page) =>
  page.getByPlaceholder("what's the plan? e.g. drinks after work")

/** A flare the new account already hosts, live now. */
function litFlare(): StubApiEvent {
  return makeStubFlare({
    _id: "event-e2e-mine",
    hostId: "user-e2e-1",
    title: "drinks at the canal",
  })
}

async function register(page: Page) {
  await page.getByLabel("your name").fill("Sam")
  await page.getByLabel("username").fill("sam")
  await page.getByLabel("email").fill("sam@example.com")
  await page.getByLabel("password").fill("password123")
  await page.getByRole("button", { name: /create account/i }).click()
}

/** Signs up from /register, with no kept draft, and lands on the map. */
async function signUp(
  page: Page,
  options: { friends: number; hosted?: StubApiEvent[] }
) {
  const stub = await stubBackend(page, {
    signedOut: true,
    friends: options.friends,
    hostedFlares: options.hosted ?? [],
    coords: BERLIN_COORDS,
    // The composer's "all friends" audience is the "all" circle.
    circles: options.friends
      ? [
          {
            _id: "circle-all",
            name: "all friends",
            type: "all",
            memberCount: options.friends,
          },
        ]
      : [],
  })
  await page.goto("/register")
  await register(page)
  await expect(nav(page)).toBeVisible()
  return stub
}

/** Starts a flare from an idea spot signed out, then signs up with it kept. */
async function signUpWithKeptDraft(page: Page, options: { friends: number }) {
  await page.clock.setFixedTime(JUNE)
  const stub = await stubBackend(page, {
    signedOut: true,
    friends: options.friends,
    hostedFlares: [],
  })
  await page.goto("/")
  await page.getByRole("button", { name: `idea: ${MAYBACH}` }).click()
  await page
    .locator("[data-quiet-card]")
    .getByRole("button", { name: "light a flare" })
    .click()
  await page
    .locator('[data-sheet="sign up"]')
    .getByRole("link", { name: "create an account" })
    .click()
  await register(page)
  await expect(
    welcome(page).getByText("welcome in. here's the flare you started.")
  ).toBeVisible()
  return stub
}

test.describe("post-sign-up checklist (#459)", () => {
  test("0 friends, not now: both rows open, and the button adds a first friend", async ({
    page,
  }) => {
    await page.clock.setFixedTime(JUNE)
    const stub = await signUp(page, { friends: 0 })

    await expect(checklist(page)).toBeVisible()
    await expect(
      checklist(page).getByRole("heading", { name: "two things to get going" })
    ).toBeVisible()
    // Not the intro, and not the slides' label.
    await expect(
      page.getByRole("dialog", { name: "welcome to sponti" })
    ).toHaveCount(0)
    await expect(row(page, "flare")).toHaveAttribute("data-done", "false")
    await expect(row(page, "flare")).toContainText("idea nearby:")
    await expect(row(page, "friend")).toHaveAttribute("data-done", "false")
    await expect(row(page, "friend")).toContainText("flares only go to friends")

    // The first-friend step: the QR and the invite link, with "later".
    await checklist(page)
      .getByRole("button", { name: "add your first friend" })
      .click()
    await expect(firstFriend(page)).toBeVisible()
    await expect(firstFriend(page).getByAltText(/^QR code for @/)).toBeVisible()
    await expect(
      firstFriend(page).getByRole("button", { name: "share sponti link" })
    ).toBeEnabled()
    await firstFriend(page).getByRole("button", { name: "later" }).click()
    await expect(firstFriend(page)).toHaveCount(0)
    await expect(checklist(page)).toBeVisible()

    // Someone scans the QR while it's open: the friend row ticks off, and
    // the button turns to lighting a flare.
    await checklist(page)
      .getByRole("button", { name: "add your first friend" })
      .click()
    await expect(firstFriend(page)).toBeVisible()
    stub.setFriends(1)
    await expect(firstFriend(page)).toHaveCount(0)
    await expect(row(page, "friend")).toHaveAttribute("data-done", "true")
    await expect(row(page, "friend")).toContainText("lena's here")
    await expect(
      checklist(page).getByRole("button", { name: "light your first flare" })
    ).toBeVisible()
  })

  test("0 friends, lit: the flare row is done, and the friend row says why no one sees it", async ({
    page,
  }) => {
    await signUp(page, { friends: 0, hosted: [litFlare()] })

    await expect(row(page, "flare")).toHaveAttribute("data-done", "true")
    await expect(row(page, "flare")).toContainText(
      "drinks at the canal is live"
    )
    await expect(row(page, "friend")).toContainText(
      "flares only go to friends, and you have none here yet"
    )
    await expect(
      checklist(page).getByRole("button", { name: "add your first friend" })
    ).toBeVisible()
  })

  test("3 friends, not now: the friend row is done, and lighting a flare finishes it", async ({
    page,
  }) => {
    await page.clock.setFixedTime(JUNE)
    await signUp(page, { friends: 3 })

    await expect(row(page, "friend")).toHaveAttribute("data-done", "true")
    await expect(row(page, "friend")).toContainText(
      "lena, mia and sam are here"
    )
    await expect(row(page, "flare")).toHaveAttribute("data-done", "false")

    await checklist(page)
      .getByRole("button", { name: "light your first flare" })
      .click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).not.toHaveValue("")
    await page
      .getByRole("button", { name: "light a flare", exact: true })
      .click()
    await expect(composerTitle(page)).toBeHidden()

    await expect(
      checklist(page).getByRole("heading", { name: "you're set" })
    ).toBeVisible()
  })

  test("3 friends, lit: you're set, and it stays away once hidden", async ({
    page,
  }) => {
    await signUp(page, { friends: 3, hosted: [litFlare()] })

    await expect(
      checklist(page).getByRole("heading", { name: "you're set" })
    ).toBeVisible()
    await expect(checklist(page)).toContainText(
      "your friends can see your flares now"
    )
    await checklist(page).getByRole("button", { name: "hide" }).click()
    await expect(checklist(page)).toHaveCount(0)

    await page.reload()
    await expect(nav(page)).toBeVisible()
    await expect(checklist(page)).toHaveCount(0)
  })

  test("hiding an open checklist keeps it hidden after a reload", async ({
    page,
  }) => {
    await signUp(page, { friends: 0 })
    await expect(checklist(page)).toBeVisible()
    await checklist(page).getByRole("button", { name: "hide" }).click()
    await expect(checklist(page)).toHaveCount(0)

    await page.reload()
    await expect(nav(page)).toBeVisible()
    await expect(checklist(page)).toHaveCount(0)
  })

  test("signing in on an existing account shows no checklist", async ({
    page,
  }) => {
    await stubBackend(page, { signedOut: true, hostedFlares: [] })
    await page.goto("/login")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: "sign in", exact: true }).click()
    await expect(nav(page)).toBeVisible()
    await page.waitForTimeout(500)
    await expect(checklist(page)).toHaveCount(0)
  })
})

test.describe("first friend before the kept draft is lit (#459)", () => {
  test("0 friends: let's light it up asks for a first friend, then lights", async ({
    page,
  }) => {
    const stub = await signUpWithKeptDraft(page, { friends: 0 })
    // The checklist waits under the welcome.
    await expect(checklistNode(page)).toBeAttached()

    await welcome(page)
      .getByRole("button", { name: "let's light it up" })
      .click()
    await expect(firstFriend(page)).toBeVisible()
    await expect(composerTitle(page)).not.toBeInViewport()

    // A friend scans the QR: on to the composer, with the kept idea.
    stub.setFriends(1)
    await expect(firstFriend(page)).toHaveCount(0)
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue(MAYBACH)
  })

  test("0 friends: later goes back to the checklist without lighting", async ({
    page,
  }) => {
    await signUpWithKeptDraft(page, { friends: 0 })
    await welcome(page)
      .getByRole("button", { name: "let's light it up" })
      .click()
    await expect(firstFriend(page)).toBeVisible()

    await firstFriend(page).getByRole("button", { name: "later" }).click()
    await expect(firstFriend(page)).toHaveCount(0)
    await expect(composerTitle(page)).not.toBeInViewport()
    await expect(checklist(page)).toBeVisible()
    await expect(row(page, "flare")).toHaveAttribute("data-done", "false")
    await expect(
      checklist(page).getByRole("button", { name: "add your first friend" })
    ).toBeVisible()
  })

  test("with a friend already, let's light it up goes straight to the composer", async ({
    page,
  }) => {
    await signUpWithKeptDraft(page, { friends: 1 })
    await welcome(page)
      .getByRole("button", { name: "let's light it up" })
      .click()
    await expect(composerTitle(page)).toBeInViewport()
    await expect(composerTitle(page)).toHaveValue(MAYBACH)
    await expect(firstFriend(page)).toHaveCount(0)
  })
})
