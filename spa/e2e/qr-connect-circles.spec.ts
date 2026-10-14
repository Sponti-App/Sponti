import { expect, test, type Page } from "@playwright/test"
import { API_BASE, stubBackend } from "./support/stubs"

// #585: scanning a QR code connects you at once, so the contact-link screen
// offers the same one-tap circle choice as the feed does after an accept.

const NOOR = {
  id: "user-e2e-noor",
  username: "noor",
  displayName: "noor",
  avatarUrl: null,
}

async function stubScan(
  page: Page,
  { alreadyFriends = false }: { alreadyFriends?: boolean } = {}
) {
  await stubBackend(page, {
    circles: [
      { _id: "circle-all", name: "all friends", type: "all", memberCount: 0 },
      {
        _id: "circle-close",
        name: "close friends",
        type: "close",
        memberCount: 0,
      },
      {
        _id: "circle-inner",
        name: "inner circle",
        type: "inner",
        memberCount: 0,
      },
    ],
  })
  const writes: string[] = []
  let connected = alreadyFriends
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  })

  // Registered after the backend stub, so it answers first.
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "")

    if (path === "/qr-contact-tokens/resolve") {
      const body = request.postDataJSON() as { connect?: boolean }
      if (body.connect) connected = true
      await route.fulfill(
        json({
          data: {
            profile: NOOR,
            relationship: connected ? "connected" : "none",
            canConnect: !connected,
            expiresAt: "2099-01-01T00:00:00.000Z",
            expired: false,
            connection: body.connect
              ? { processed: true, delivered: true, autoAccepted: true }
              : null,
          },
        })
      )
      return
    }
    if (request.method() === "POST" && path.startsWith("/circles/")) {
      writes.push(`POST ${path} ${request.postData()}`)
      await route.fulfill(json({ data: {} }))
      return
    }
    await route.fallback()
  })
  return writes
}

test.describe("circle prompt after a QR connect (#585)", () => {
  test("connecting offers the circles under you're friends, and a tap adds them", async ({
    page,
  }) => {
    const writes = await stubScan(page)
    await page.goto("/qr/scan123")

    await page.getByRole("button", { name: "connect" }).click()

    await expect(page.getByText("you're friends")).toBeVisible()
    const chips = page.getByRole("group", { name: "add noor to a circle" })
    await expect(chips.getByRole("button")).toHaveText([
      "close friends",
      "inner circle",
      "skip",
    ])

    await chips.getByRole("button", { name: "inner circle" }).click()

    await expect(page.getByText("added to inner circle")).toBeVisible()
    expect(writes).toEqual([
      `POST /circles/circle-inner/members {"userId":"${NOOR.id}"}`,
    ])
  })

  test("skip ends the prompt without adding anyone", async ({ page }) => {
    const writes = await stubScan(page)
    await page.goto("/qr/scan123")
    await page.getByRole("button", { name: "connect" }).click()

    await page.getByRole("button", { name: "skip" }).click()

    await expect(page.getByText("you’re connected")).toBeVisible()
    expect(writes).toEqual([])
  })

  test("opening the code of someone who is already a friend shows no prompt", async ({
    page,
  }) => {
    await stubScan(page, { alreadyFriends: true })
    await page.goto("/qr/scan123")

    await expect(page.getByText("you're friends")).toBeVisible()
    await expect(
      page.getByRole("group", { name: "add noor to a circle" })
    ).toHaveCount(0)
  })
})
