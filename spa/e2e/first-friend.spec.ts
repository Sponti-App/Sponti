import { expect, test } from "@playwright/test"
import { INVITER, stubSignedOutContactFlow } from "./support/contact-stubs"

// #124 / #441: someone without a session opens a friend's QR code or invite
// link. They first see who wants to connect, with sign in and create account
// as equal choices; either one keeps the way back to the link, where they
// connect (QR), send a request (invite link) or, if the code ran out while
// they signed up, send a request instead.

const WANTS = `${INVITER.displayName} wants to connect on sponti`

test.describe("first friend from a link (#124, #441)", () => {
  test("a signed-out QR scan leads with the person and both choices", async ({
    page,
  }) => {
    const calls = await stubSignedOutContactFlow(page)

    await page.goto("/qr/scan123")

    await expect(page).toHaveURL(/\/qr\/scan123$/)
    await expect(page.getByRole("heading", { name: WANTS })).toBeVisible()
    // Dev-mode StrictMode may fire the (aborted) lookup twice; each one asks
    // only about this link.
    expect(calls.previews.length).toBeGreaterThanOrEqual(1)
    for (const preview of calls.previews) {
      expect(preview).toEqual({ kind: "qr", token: "scan123" })
    }
    await expect(page.getByRole("link", { name: "sign in" })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Fqr%2Fscan123"
    )
    await expect(
      page.getByRole("link", { name: "create account" })
    ).toHaveAttribute("href", "/register?redirectTo=%2Fqr%2Fscan123")
    await expect(page.getByLabel("your name")).toHaveCount(0)
  })

  test("sign in from a QR scan returns to the code and connects", async ({
    page,
  }) => {
    const calls = await stubSignedOutContactFlow(page)

    await page.goto("/qr/scan123")
    await page.getByRole("link", { name: "sign in" }).click()

    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fqr%2Fscan123$/)
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: "sign in" }).click()

    await expect(page).toHaveURL(/\/qr\/scan123$/)
    expect(calls.logins).toHaveLength(1)
    await expect(
      page.getByText(`you're with ${INVITER.displayName}.`, { exact: false })
    ).toBeVisible()

    await page.getByRole("button", { name: "connect" }).click()

    await expect(
      page.getByText(`you and ${INVITER.displayName} are friends on sponti.`)
    ).toBeVisible()
    const connectCall = calls.resolves.find(
      (call) => (call.body as { connect?: boolean }).connect
    )
    expect(connectCall).toMatchObject({
      path: "/qr-contact-tokens/resolve",
      body: { token: "scan123", connect: true },
      auth: "Bearer e2e-access-token",
    })
  })

  test("create account from an invite link → back to the link to send a request", async ({
    page,
  }) => {
    const calls = await stubSignedOutContactFlow(page)

    await page.goto("/invite/abc123")

    await expect(page).toHaveURL(/\/invite\/abc123$/)
    await expect(page.getByRole("heading", { name: WANTS })).toBeVisible()
    await page.getByRole("link", { name: "create account" }).click()

    await expect(page).toHaveURL(/\/register\?redirectTo=%2Finvite%2Fabc123$/)
    await expect(
      page.getByText(`join ${INVITER.displayName} on sponti`)
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "sign in" })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Finvite%2Fabc123"
    )

    await page.getByLabel("your name").fill("Sam")
    await page.getByLabel("username").fill("sam")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/invite\/abc123$/)
    await expect(
      page.getByText(`send ${INVITER.displayName} a friend request.`)
    ).toBeVisible()
    expect(calls.registrations).toHaveLength(1)

    await page.getByRole("button", { name: "send request" }).click()

    await expect(
      page.getByText(`your request to ${INVITER.displayName} is pending.`)
    ).toBeVisible()
    const connectCall = calls.resolves.find(
      (call) => (call.body as { connect?: boolean }).connect
    )
    expect(connectCall).toMatchObject({
      path: "/invite-links/resolve",
      body: { token: "abc123", connect: true },
      auth: "Bearer e2e-access-token",
    })
  })

  test("a QR code that ran out during sign-up offers a friend request instead", async ({
    page,
  }) => {
    const calls = await stubSignedOutContactFlow(page, { qrExpired: true })

    await page.goto("/qr/old123")
    await page.getByRole("link", { name: "create account" }).click()
    await page.getByLabel("your name").fill("Sam")
    await page.getByLabel("username").fill("sam")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/qr\/old123$/)
    await expect(
      page.getByText(
        `this code expired, but you can still send ${INVITER.displayName} a friend request.`
      )
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "connect" })).toHaveCount(0)

    await page.getByRole("button", { name: "send request" }).click()

    await expect(
      page.getByText(`your request to ${INVITER.displayName} is pending.`)
    ).toBeVisible()
    expect(calls.resolves.at(-1)).toMatchObject({
      path: "/qr-contact-tokens/resolve",
      body: { token: "old123", connect: true },
    })
  })

  test("a link that is no longer live keeps both choices with generic copy", async ({
    page,
  }) => {
    const calls = await stubSignedOutContactFlow(page, { previewName: null })

    await page.goto("/qr/expired123")

    await expect(
      page.getByRole("heading", { name: "a friend wants to connect on sponti" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "sign in" })).toBeVisible()
    await expect(
      page.getByRole("link", { name: "create account" })
    ).toBeVisible()
    await expect.poll(() => calls.previews.length).toBeGreaterThanOrEqual(1)
    expect(calls.previews[0]).toEqual({ kind: "qr", token: "expired123" })
  })

  test("sign-in from the register page keeps the way back to the link", async ({
    page,
  }) => {
    await stubSignedOutContactFlow(page)

    await page.goto("/invite/abc123")
    await page.getByRole("link", { name: "create account" }).click()
    await expect(page).toHaveURL(/\/register\?/)
    await page.getByRole("link", { name: "sign in" }).click()

    await expect(page).toHaveURL(/\/login\?redirectTo=%2Finvite%2Fabc123$/)
    await expect(page.getByRole("link", { name: "register" })).toHaveAttribute(
      "href",
      "/register?redirectTo=%2Finvite%2Fabc123"
    )
  })
})
