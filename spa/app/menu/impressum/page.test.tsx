import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ImpressumPage from "./page"

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

describe("impressum (#293)", () => {
  it("shows the legal notice headings", () => {
    render(<ImpressumPage />)

    expect(
      screen.getByRole("heading", { name: "Legal notice" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Provider (§ 5 DDG)" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        name: "Responsible for content (§ 18 (2) MStV)",
      })
    ).toBeInTheDocument()
  })

  it("names the provider, the address and the shared contact email", () => {
    render(<ImpressumPage />)

    const text = document.body.textContent ?? ""
    expect(text).toContain("Test Provider")
    expect(text).toContain("Teststr. 1")
    expect(text).toContain("12345 Testville")

    expect(
      screen.getByRole("link", { name: "inbox@sponti.test" })
    ).toHaveAttribute("href", "mailto:inbox@sponti.test")
  })
})
