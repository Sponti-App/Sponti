import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  showActionFeedback: vi.fn(),
  useAuth: vi.fn(),
  fetchMyCircles: vi.fn(),
  fetchAcceptedConnections: vi.fn(),
  useGeolocation: vi.fn(),
  emitEventsChanged: vi.fn(),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () =>
    mocks.useAuth() ?? {
      user: { id: "u1", displayName: "Test" },
      status: "authenticated",
    },
}))

vi.mock("@/lib/api/circles", () => ({
  fetchMyCircles: () => mocks.fetchMyCircles() ?? Promise.resolve([]),
  addCircleMember: vi.fn().mockResolvedValue(undefined),
  removeCircleMember: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/api/connections", () => ({
  fetchAcceptedConnections: () =>
    mocks.fetchAcceptedConnections() ?? Promise.resolve([]),
}))

vi.mock("@/lib/geolocation", () => ({
  useGeolocation: () =>
    mocks.useGeolocation() ?? {
      coords: null,
      status: "idle",
      errorMessage: null,
      request: vi.fn(),
    },
}))

vi.mock("@/lib/use-events", () => ({
  emitEventsChanged: mocks.emitEventsChanged,
}))

vi.mock("@/lib/haptics", () => ({
  haptic: vi.fn(),
}))

import { NewEventDrawer } from "./new-event-drawer"

describe("NewEventDrawer render", () => {
  it("renders title and CTA when open", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    expect(screen.getAllByText("light a flare").length).toBeGreaterThanOrEqual(
      1
    )
    expect(screen.getByPlaceholderText(/what's the plan/i)).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-vaul-snap-points",
      "true"
    )
  })

  it("renders mode toggle tabs", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    expect(screen.getByText("right now")).toBeInTheDocument()
    expect(screen.getByText("pick a time")).toBeInTheDocument()
  })

  it("does not autoFocus the title input", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText(/what's the plan/i)
    expect(input).not.toHaveFocus()
  })

  // vaul slides the sheet down by (viewport − snap); without an explicit
  // viewport-filling height the sheet lands entirely below the viewport.
  // Geometry itself needs a real browser — this locks in the height contract.
  //
  // Regression guard for issue #94: vaul rewrites this node's inline
  // `height`/`bottom` in px when the software keyboard opens, so the contract
  // has to be expressed in classes it can safely clobber (bottom:0, h-full)
  // rather than an inline offset it silently destroys.
  it("anchors the sheet to the bottom at full viewport height", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.className).toContain("bottom-0")
    expect(dialog.className).toContain("h-full")
    expect(dialog.style.height).toBe("")
    expect(dialog.style.bottom).toBe("")
  })

  // The sheet must stay modal: vaul disables its entire iOS keyboard handling
  // when `modal` is false (usePreventScroll's isDisabled includes `!modal`),
  // which is what let Safari scroll the page out from under the fixed sheet in
  // issue #94. An inert background is the cost, and the point.
  //
  // NB: the matching "…and is released on close" assertion is not testable
  // here. Radix keeps the layer mounted until the exit animation ends, and
  // jsdom mis-resolves vaul's attribute-selector CSS — it reports the
  // `[data-vaul-snap-points=false]` close animation that never applies to a
  // snap-point drawer in a real browser — so Presence never completes.
  // Verified on device instead; see the PR checklist.
  it("makes the background inert while open", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    expect(document.body.style.pointerEvents).toBe("none")
  })

  // The sheet used to only ever grow: expanding "how long?" raised it to mid
  // and collapsing it again left a tall sheet with a dead gap under the
  // controls. Tapping a chip should size the sheet to what that state needs.
  it("returns to peek when an expanded section is collapsed", async () => {
    const user = userEvent.setup()
    render(<NewEventDrawer open onClose={vi.fn()} />)
    const card = screen.getByRole("dialog").firstElementChild as HTMLElement

    expect(card.style.height).toBe("380px")

    const whenChip = screen.getByRole("button", { name: /now · 1h/i })
    await user.click(whenChip)
    expect(card.style.height).toBe("calc(0.7 * var(--sponti-vvh, 100vh))")

    await user.click(whenChip)
    expect(card.style.height).toBe("380px")
  })
})
