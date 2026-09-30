import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PrivacyPage from "./page"

vi.mock("@/lib/contact", () => ({ CONTACT_EMAIL: "inbox@sponti.test" }))

describe("privacy note (#129)", () => {
  it("says it's a test build", () => {
    render(<PrivacyPage />)

    expect(
      screen.getByRole("heading", { name: "sponti is a test build." })
    ).toBeInTheDocument()
  })

  it("asks for deletion at the shared contact address", () => {
    render(<PrivacyPage />)

    const link = screen.getByRole("link", { name: "inbox@sponti.test" })
    expect(link).toHaveAttribute("href", "mailto:inbox@sponti.test")
    expect(document.body.textContent).not.toContain("example.com")
  })

  it("covers what we collect, who sees it, where it lives and retention", () => {
    render(<PrivacyPage />)

    for (const name of [
      "what we collect",
      "who can see what",
      "where it's stored",
      "how long we keep it",
      "delete your data",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument()
    }
  })

  it("drops the old prototype wording", () => {
    render(<PrivacyPage />)

    expect(document.body.textContent).not.toMatch(/prototype|simulated/i)
  })
})
