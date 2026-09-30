import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TermsPage from "./page"

vi.mock("@/lib/contact", () => ({ CONTACT_EMAIL: "inbox@sponti.test" }))

describe("terms page (#129)", () => {
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
})
