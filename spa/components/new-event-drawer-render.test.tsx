import { render, screen } from "@testing-library/react"
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
    expect(screen.getAllByText("light a flare").length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByPlaceholderText(/what's the plan/i),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveAttribute("data-vaul-snap-points", "true")
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
})
