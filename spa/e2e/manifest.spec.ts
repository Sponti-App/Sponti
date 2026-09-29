import { expect, test } from "@playwright/test"
import { stubBackend } from "./support/stubs"

// #131: the page must advertise the manifest and per-scheme theme colours so
// "Add to Home Screen" launches standalone, and every icon it points at must
// resolve (no 404s, cf. #106).
test.describe("installable web app (#131)", () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page)
    await page.goto("/")
  })

  test("links the manifest and light/dark theme-color tags", async ({
    page,
  }) => {
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest"
    )
    await expect(
      page.locator(
        'meta[name="theme-color"][media="(prefers-color-scheme: light)"]'
      )
    ).toHaveAttribute("content", "#fdf1f7")
    await expect(
      page.locator(
        'meta[name="theme-color"][media="(prefers-color-scheme: dark)"]'
      )
    ).toHaveAttribute("content", "#171a21")
    await expect(
      page.locator('meta[name="apple-mobile-web-app-capable"]')
    ).toHaveAttribute("content", "yes")
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]')
    ).toHaveAttribute("content", "sponti")
  })

  test("serves the manifest and every icon it declares", async ({
    page,
    request,
  }) => {
    const href = await page.locator('link[rel="manifest"]').getAttribute("href")
    const res = await request.get(href!)
    expect(res.ok()).toBe(true)
    const manifest = await res.json()
    expect(manifest.display).toBe("standalone")
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3)

    for (const icon of manifest.icons) {
      const iconRes = await request.get(icon.src)
      expect(iconRes.status(), icon.src).toBe(200)
      expect(iconRes.headers()["content-type"]).toContain("image/png")
    }
  })
})
