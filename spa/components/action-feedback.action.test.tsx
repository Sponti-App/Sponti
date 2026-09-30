import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ActionFeedbackProvider, useActionFeedback } from "./action-feedback"

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

function Trigger({ onUndo }: { onUndo: () => void }) {
  const { showActionFeedback } = useActionFeedback()
  return (
    <button
      type="button"
      onClick={() =>
        showActionFeedback("accepted maya", {
          durationMs: 5000,
          action: { label: "undo", onAction: onUndo },
        })
      }
    >
      go
    </button>
  )
}

// #226: the undo toast for accepting a request.
describe("action feedback with an action", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("shows the action for the given duration, runs it and closes on tap", () => {
    const onUndo = vi.fn()
    render(
      <ActionFeedbackProvider>
        <Trigger onUndo={onUndo} />
      </ActionFeedbackProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "go" }))
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getByText("accepted maya")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "undo" }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("accepted maya")).not.toBeInTheDocument()
  })

  it("goes away on its own after the duration", () => {
    render(
      <ActionFeedbackProvider>
        <Trigger onUndo={vi.fn()} />
      </ActionFeedbackProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "go" }))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByText("accepted maya")).not.toBeInTheDocument()
  })
})
