import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { IdeaIcon } from "@/components/idea-icon"
import { FLARE_IDEAS } from "@/lib/flare-ideas.data"
import { ANYWHERE_IDEAS } from "@/lib/flare-ideas.anywhere.data"

const glyph = (idea: Parameters<typeof IdeaIcon>[0]["idea"]) =>
  render(<IdeaIcon idea={idea} />)
    .container.querySelector("svg")
    ?.getAttribute("data-icon")

describe("IdeaIcon (#524)", () => {
  it("shows an idea's own icon, not its category's", () => {
    const hill = FLARE_IDEAS.find((i) => i.id === "viktoriapark-hill")
    expect(hill?.category).toBe("hangout")
    expect(glyph(hill!)).toBe("mountains")
  })

  it("falls back to the category's icon", () => {
    expect(glyph({ category: "drinks" })).toBe("wine")
  })

  it("every idea has its own icon", () => {
    const missing = [...FLARE_IDEAS, ...ANYWHERE_IDEAS].filter((i) => !i.icon)
    expect(missing.map((i) => i.id)).toEqual([])
  })
})
