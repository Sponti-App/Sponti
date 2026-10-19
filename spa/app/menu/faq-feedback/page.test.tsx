import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
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

// The feedback sheet sends from a toast-aware component; the app's layout
// provides this, so the page test stands in for it.
vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: vi.fn() }),
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

  it("opens the feedback sheet, and sends safety reports to support", async () => {
    render(<FaqFeedbackPage />)

    expect(
      screen.getByRole("link", { name: "safety report or account help" })
    ).toHaveAttribute("href", "/menu/support")
    expect(document.body.textContent).not.toMatch(/@\w+\./)

    // The sheet's form is only there once it is opened.
    expect(screen.queryByRole("textbox")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "send feedback" }))
    expect(
      await screen.findByRole("textbox", { name: "your feedback" })
    ).toBeInTheDocument()
  })

  it("links the three legal pages", () => {
    render(<FaqFeedbackPage />)

    expect(
      screen.getByRole("link", { name: "read the terms of service" })
    ).toHaveAttribute("href", "/menu/terms")
    expect(
      screen.getByRole("link", { name: "read the privacy note" })
    ).toHaveAttribute("href", "/menu/privacy")
    expect(
      screen.getByRole("link", { name: "read the impressum" })
    ).toHaveAttribute("href", "/menu/impressum")
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
