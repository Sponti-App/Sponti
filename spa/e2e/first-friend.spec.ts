import { expect, test } from "@playwright/test"
import { INVITER, stubSignedOutContactFlow } from "./support/contact-stubs"

// #124: someone without an account opens a friend's invite link, lands
// straight on sign-up ("join {name} on sponti"), registers, and is brought
// back to the link to send the request. Also checks the redirectTo survives
// the hop to sign-in.

// Next dev compiles /register, /login and the link pages on first visit; give
// navigations room for that under parallel workers.
const FIRST_COMPILE = { timeout: 30_000 }

test.describe("first friend from a link (#124)", () => {
  test("signed-out visitor → sign-up → back to the invite to send a request", async ({
    page,
  }) => {
    const calls = await stubSignedOutContactFlow(page)

    await page.goto("/invite/abc123")

    await expect(page).toHaveURL(
      /\/register\?redirectTo=%2Finvite%2Fabc123$/,
      FIRST_COMPILE
    )
    await expect(
      page.getByText(`join ${INVITER.displayName} on sponti`)
    ).toBeVisible()
    // Dev-mode StrictMode may fire the (aborted) lookup twice; each one asks
    // only about this link.
    expect(calls.previews.length).toBeGreaterThanOrEqual(1)
    for (const preview of calls.previews) {
      expect(preview).toEqual({ kind: "invite", token: "abc123" })
    }
    await expect(page.getByRole("link", { name: "sign in" })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Finvite%2Fabc123"
    )

    await page.getByLabel("your name").fill("Sam")
    await page.getByLabel("username").fill("sam")
    await page.getByLabel("email").fill("sam@example.com")
    await page.getByLabel("password").fill("password123")
    await page.getByRole("button", { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/invite\/abc123$/, FIRST_COMPILE)
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

  test("a QR link that is no longer live keeps the generic sign-up copy", async ({
    page,
  }) => {
    const calls = await stubSignedOutContactFlow(page, { previewName: null })

    await page.goto("/qr/expired123")

    await expect(page).toHaveURL(
      /\/register\?redirectTo=%2Fqr%2Fexpired123$/,
      FIRST_COMPILE
    )
    await expect(page.getByText("claim your handle")).toBeVisible()
    await expect.poll(() => calls.previews.length).toBeGreaterThanOrEqual(1)
    expect(calls.previews[0]).toEqual({ kind: "qr", token: "expired123" })
    await expect(page.getByText(/on sponti$/)).toHaveCount(0)
  })

  test("sign-in from the landing keeps the way back to the link", async ({
    page,
  }) => {
    await stubSignedOutContactFlow(page)

    await page.goto("/invite/abc123")
    await expect(page).toHaveURL(/\/register\?/, FIRST_COMPILE)
    await page.getByRole("link", { name: "sign in" }).click()

    await expect(page).toHaveURL(
      /\/login\?redirectTo=%2Finvite%2Fabc123$/,
      FIRST_COMPILE
    )
    await expect(page.getByRole("link", { name: "register" })).toHaveAttribute(
      "href",
      "/register?redirectTo=%2Finvite%2Fabc123"
    )
  })
})
