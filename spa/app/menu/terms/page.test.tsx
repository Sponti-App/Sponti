import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TermsPage from "./page"

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

describe("terms page (#129, #293)", () => {
  it("uses the shared contact address everywhere and no placeholders", () => {
    render(<TermsPage />)

    const mailtos = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("mailto:"))

    expect(mailtos.length).toBeGreaterThan(0)
    expect(new Set(mailtos)).toEqual(new Set(["mailto:inbox@sponti.test"]))
    expect(document.body.textContent).not.toContain("example.com")
  })

  it("names the provider", () => {
    render(<TermsPage />)

    expect(document.body.textContent).toContain(
      "Test Provider, Teststr. 1, 12345 Testville, Germany"
    )
  })

  it("covers the key terms under German law", () => {
    render(<TermsPage />)

    for (const name of [
      "2. A free test build",
      "3. Your account",
      "4. Acceptable use",
      "5. Your content",
      "6. Blocking and reports",
      "8. Liability",
      "10. Governing law",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument()
    }

    const text = document.body.textContent ?? ""
    expect(text).toContain("at least 16")
    expect(text).toContain("intent and gross negligence")
    expect(text).toContain("Produkthaftungsgesetz")
    expect(text).toContain("German law applies")
  })

  it("drops the old school-project and generic event-app wording", () => {
    render(<TermsPage />)

    expect(document.body.textContent).not.toMatch(
      /educational|prototype|WBS|Sweden|Swedish|ticket|organi[sz]er profiles/i
    )
  })
})
