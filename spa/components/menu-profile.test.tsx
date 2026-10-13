import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MenuProfile } from "./menu-profile"

// #559: the menu card opens your profile; "edit profile" sits beside it.

const mocks = vi.hoisted(() => ({
  user: { displayName: "Flare Tester", username: "flaretester" } as {
    displayName: string
    username?: string
  } | null,
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: mocks.user, status: "authenticated" }),
}))

describe("MenuProfile", () => {
  it("opens your profile, with edit profile beside it", () => {
    render(<MenuProfile />)

    expect(
      screen.getByRole("link", { name: /@flaretester · view profile/ })
    ).toHaveAttribute("href", "/profile/flaretester")
    expect(screen.getByRole("link", { name: "edit profile" })).toHaveAttribute(
      "href",
      "/settings/profile"
    )
  })

  it("falls back to the edit page until the username is known", () => {
    mocks.user = { displayName: "Flare Tester" }
    render(<MenuProfile />)

    expect(screen.getByRole("link", { name: /view profile/ })).toHaveAttribute(
      "href",
      "/settings/profile"
    )
  })
})
