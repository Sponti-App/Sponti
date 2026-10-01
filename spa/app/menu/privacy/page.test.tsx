import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PrivacyPage from "./page"

vi.mock("@/lib/contact", () => ({
  CONTACT_EMAIL: "inbox@sponti.test",
  PROVIDER: {
    name: "Test Provider",
    street: "Teststr. 1",
    postalCode: "12345",
    city: "Testville",
    country: "Germany",
  },
  PROVIDER_ADDRESS_LINE: "Teststr. 1, 12345 Testville, Germany",
}))

describe("privacy note (#129, #293)", () => {
  it("says it's a test build", () => {
    render(<PrivacyPage />)

    expect(
      screen.getByRole("heading", { name: "Sponti is a test build." })
    ).toBeInTheDocument()
  })

  it("names the provider as controller", () => {
    render(<PrivacyPage />)

    expect(document.body.textContent).toContain(
      "Test Provider, Teststr. 1, 12345 Testville, Germany"
    )
  })

  it("points to the shared contact address and the Impressum", () => {
    render(<PrivacyPage />)

    const mailtos = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("mailto:"))
    expect(mailtos.length).toBeGreaterThan(0)
    expect(new Set(mailtos)).toEqual(new Set(["mailto:inbox@sponti.test"]))
    expect(document.body.textContent).not.toContain("example.com")

    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute(
      "href",
      "/menu/impressum"
    )
  })

  it("covers the GDPR basics", () => {
    render(<PrivacyPage />)

    for (const name of [
      "Who is responsible",
      "What we collect",
      "Why we use it",
      "Who can see what",
      "Who else handles your data",
      "How long we keep it",
      "Delete your data",
      "Your rights",
      "Who can use Sponti",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument()
    }
  })

  it("states the retention, age, authority and private-profile facts", () => {
    render(<PrivacyPage />)

    const text = document.body.textContent ?? ""
    expect(text).toContain("Within 30 days we'll delete your account")
    expect(text).toContain("after 14 days at the latest")
    expect(text).toContain("at least 16")
    expect(text).toContain("Berliner Beauftragte für Datenschutz")
    expect(text).toContain("exact @username")
  })

  it("drops the old prototype wording", () => {
    render(<PrivacyPage />)

    expect(document.body.textContent).not.toMatch(/prototype|simulated/i)
  })
})
