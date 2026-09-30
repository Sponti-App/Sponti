import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Circle } from "@/lib/circles"
import { CircleChips, type CircleChipsState } from "./circle-chips"

const circles: Circle[] = [
  {
    id: "all",
    name: "all friends",
    description: "",
    memberIds: [],
    type: "all",
  },
  {
    id: "close",
    name: "close friends",
    description: "",
    memberIds: [],
    type: "close",
  },
  {
    id: "inner",
    name: "inner circle",
    description: "",
    memberIds: [],
    type: "inner",
  },
]

function renderChips(
  state: CircleChipsState = { status: "choosing" },
  list: Circle[] | null = circles
) {
  const onPick = vi.fn()
  const onSkip = vi.fn()
  render(
    <CircleChips
      circles={list}
      personId="p"
      personName="maya"
      state={state}
      onPick={onPick}
      onSkip={onSkip}
    />
  )
  return { onPick, onSkip }
}

describe("CircleChips (#226)", () => {
  it("offers close friends, inner circle and skip, but not all friends", () => {
    renderChips()
    const group = screen.getByRole("group", { name: "add maya to a circle" })
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["close friends", "inner circle", "skip"])
  })

  it("calls back with the tapped circle, or skip", async () => {
    const user = userEvent.setup()
    const { onPick, onSkip } = renderChips()

    await user.click(screen.getByRole("button", { name: "inner circle" }))
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "inner" })
    )

    await user.click(screen.getByRole("button", { name: "skip" }))
    expect(onSkip).toHaveBeenCalled()
  })

  it("marks the chip being added and locks the others", () => {
    renderChips({
      status: "adding",
      circle: { id: "close", name: "close friends" },
    })

    const close = screen.getByRole("button", { name: "close friends" })
    expect(close).toHaveAttribute("aria-pressed", "true")
    expect(close).toHaveClass("bg-card", "text-primary")
    expect(screen.getByRole("button", { name: "inner circle" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "skip" })).toBeDisabled()
  })

  it("confirms once added", () => {
    renderChips({
      status: "added",
      circle: { id: "close", name: "close friends" },
    })
    expect(screen.getByRole("status")).toHaveTextContent(
      "added to close friends"
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("says they're connected after skip", () => {
    renderChips({ status: "skipped" })
    expect(screen.getByRole("status")).toHaveTextContent("you’re connected")
  })

  it("shows a loading line while circles load, with skip still there", () => {
    renderChips({ status: "choosing" }, null)
    expect(screen.getByText("loading circles")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "skip" })).toBeEnabled()
  })
})
