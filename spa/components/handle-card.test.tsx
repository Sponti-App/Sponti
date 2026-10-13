import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { AuthUser } from "@/lib/auth-store"
import { HandleCard } from "./handle-card"

// #486: the line under the card only promises search while discovery is on.

const user = (profileVisibility: AuthUser["profileVisibility"]) =>
  ({
    id: "u1",
    username: "flaretester",
    displayName: "Flare Tester",
    profileVisibility,
  }) as AuthUser

describe("HandleCard", () => {
  it("says friends can find you by handle while your profile is public", () => {
    render(<HandleCard user={user("public")} onShare={() => {}} />)

    expect(
      screen.getByText(/anyone with your @handle can find you/)
    ).toBeInTheDocument()
  })

  it("doesn't promise search while your profile is hidden from it", () => {
    render(<HandleCard user={user("private")} onShare={() => {}} />)

    expect(screen.queryByText(/can find you and send/)).not.toBeInTheDocument()
    expect(screen.getByText(/you're hidden from search/)).toBeInTheDocument()
  })
})
