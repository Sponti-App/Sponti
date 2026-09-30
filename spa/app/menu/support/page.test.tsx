import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SupportPage from "./page"

vi.mock("@/lib/contact", () => ({ CONTACT_EMAIL: "inbox@sponti.test" }))

function mailtoUrls() {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("mailto:"))
    .map((href) => new URL(href))
}

describe("support page (#126)", () => {
  it("sends every path to the one contact address", () => {
    render(<SupportPage />)

    const urls = mailtoUrls()
    // 5 support paths + the contact line
    expect(urls).toHaveLength(6)
    for (const url of urls) {
      expect(url.pathname).toBe("inbox@sponti.test")
    }
    expect(document.body.textContent).toContain("inbox@sponti.test")
    expect(document.body.textContent).not.toContain("example.com")
  })

  it("prefills the mail body with the build and this device", () => {
    render(<SupportPage />)

    const bug = mailtoUrls().find(
      (url) => url.searchParams.get("subject") === "bug report"
    )
    expect(bug).toBeDefined()
    const body = bug!.searchParams.get("body") ?? ""
    expect(body).toContain("sponti build:")
    expect(body).toContain(`browser: ${navigator.userAgent}`)
    expect(body).toContain("platform:")
    expect(body).toContain("screen:")
  })

  it("keeps the safety path first, with its own subject", () => {
    render(<SupportPage />)

    expect(mailtoUrls()[0].searchParams.get("subject")).toBe(
      "safety or content report"
    )
  })

  it("is lowercase product copy", () => {
    render(<SupportPage />)

    expect(
      screen.getByRole("heading", { name: "what do you need help with?" })
    ).toBeInTheDocument()
  })
})
