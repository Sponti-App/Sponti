import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import FaqFeedbackPage from "./page"

// The shell's back arrow is covered by its own test; keep this page test
// independent of the router.
vi.mock("@/components/menu-page-shell", () => ({
  MenuPageShell: ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

describe("faq & feedback page (#294)", () => {
  it("has no fake feedback form", () => {
    const { container } = render(<FaqFeedbackPage />)

    expect(container.querySelector("form")).toBeNull()
    expect(container.querySelector("textarea")).toBeNull()
    expect(container.querySelector("input")).toBeNull()
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull()
    expect(document.body.textContent).not.toMatch(
      /example\.com|martin@|prototype|simulated|in production/i
    )
  })

  it("sends feedback through support", () => {
    render(<FaqFeedbackPage />)

    expect(
      screen.getByRole("link", { name: "send feedback or get help" })
    ).toHaveAttribute("href", "/menu/support")
    expect(document.body.textContent).not.toMatch(/@\w+\./)
  })

  it("keeps the faq answers", () => {
    render(<FaqFeedbackPage />)

    expect(screen.getByText("who can see a flare?")).toBeInTheDocument()
    expect(
      screen.getByText("does sponti read my contacts?")
    ).toBeInTheDocument()
  })

  it("is lowercase product copy", () => {
    render(<FaqFeedbackPage />)

    expect(
      screen.getByRole("heading", { name: "faq & feedback" })
    ).toBeInTheDocument()
    for (const heading of screen.getAllByRole("heading")) {
      expect(heading.textContent).toBe(heading.textContent?.toLowerCase())
    }
  })
})
