import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { checklistView } from "@/lib/onboarding-checklist"
import { CHECKLIST_LABEL, OnboardingChecklist } from "./onboarding-checklist"

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

function renderChecklist(friendNames: string[], lit: boolean) {
  const view = checklistView({
    friendNames,
    hostedFlare: lit ? { title: "drinks", live: true } : null,
    ideaTitle: null,
  })
  if (view.kind === "loading") throw new Error("not loaded")
  const handlers = {
    onAddFriend: vi.fn(),
    onLight: vi.fn(),
    onHide: vi.fn(),
  }
  render(<OnboardingChecklist view={view} {...handlers} />)
  return handlers
}

describe("OnboardingChecklist (#459)", () => {
  it("has its own region label, not the intro slides' one", () => {
    renderChecklist([], false)
    expect(
      screen.getByRole("region", { name: CHECKLIST_LABEL })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "welcome to sponti" })
    ).not.toBeInTheDocument()
  })

  it("with no friends, its button adds the first friend, lit or not", async () => {
    const user = userEvent.setup()
    for (const lit of [true, false]) {
      const { onAddFriend, onLight } = renderChecklist([], lit)
      await user.click(
        screen.getByRole("button", { name: "add your first friend" })
      )
      expect(onAddFriend).toHaveBeenCalledTimes(1)
      expect(onLight).not.toHaveBeenCalled()
      document.body.innerHTML = ""
    }
  })

  it("with friends and no flare, its button lights the first flare", async () => {
    const user = userEvent.setup()
    const { onLight } = renderChecklist(["lena", "mia", "sam"], false)
    expect(screen.getByText("lena, mia and sam are here")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "light your first flare" })
    )
    expect(onLight).toHaveBeenCalledTimes(1)
  })

  it("with both done it says you're set, with no button but hide", async () => {
    const user = userEvent.setup()
    const { onHide } = renderChecklist(["lena", "mia", "sam"], true)
    expect(
      screen.getByRole("heading", { name: "you're set" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "hide" }))
    expect(onHide).toHaveBeenCalledTimes(1)
  })
})
