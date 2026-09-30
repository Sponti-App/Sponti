import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import AboutSpontiPage from "./page"

describe("about sponti (#293)", () => {
  it("tells the origin story and credits the WBS team", () => {
    render(<AboutSpontiPage />)

    expect(
      screen.getByRole("heading", { name: "how it started" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "wbs coding school" })
    ).toHaveAttribute("href", "https://www.wbscodingschool.com/")
    for (const name of [
      "Nil Angelats",
      "Samara Arzt",
      "Patrick Caire",
      "Martin Lindholm",
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        expect.stringContaining("linkedin.com/in/")
      )
    }
  })

  it("no longer presents sponti as a school project", () => {
    render(<AboutSpontiPage />)

    expect(document.body.textContent).not.toMatch(/final-project|educational/i)
  })
})
