import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CirclesPage from "./page"
import type { Circle, Connection } from "@/lib/circles"

const mocks = vi.hoisted(() => ({
  addCircleMember: vi.fn(),
  createCircle: vi.fn(),
  fetchAcceptedConnections: vi.fn(),
  fetchBlockedUsers: vi.fn(),
  fetchIncomingConnectionRequests: vi.fn(),
  fetchMyCircles: vi.fn(),
  fetchOutgoingConnectionRequests: vi.fn(),
  push: vi.fn(),
  removeCircleMember: vi.fn(),
  searchUsers: vi.fn(),
  showActionFeedback: vi.fn(),
  updateCircle: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { displayName: "Martin", username: "martin" },
  }),
}))

vi.mock("@/components/bottom-nav", () => ({
  BottomNav: () => <nav aria-label="primary" />,
}))

vi.mock("@/lib/api/circles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/circles")>()
  return {
    ...actual,
    addCircleMember: mocks.addCircleMember,
    createCircle: mocks.createCircle,
    fetchMyCircles: mocks.fetchMyCircles,
    removeCircleMember: mocks.removeCircleMember,
    updateCircle: mocks.updateCircle,
  }
})

vi.mock("@/lib/api/connections", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/connections")>()
  return {
    ...actual,
    fetchAcceptedConnections: mocks.fetchAcceptedConnections,
    fetchIncomingConnectionRequests: mocks.fetchIncomingConnectionRequests,
    fetchOutgoingConnectionRequests: mocks.fetchOutgoingConnectionRequests,
  }
})

vi.mock("@/lib/api/blocks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/blocks")>()
  return {
    ...actual,
    fetchBlockedUsers: mocks.fetchBlockedUsers,
  }
})

vi.mock("@/lib/api/users", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/users")>()
  return {
    ...actual,
    searchUsers: mocks.searchUsers,
  }
})

const ada: Connection = {
  id: "user-1",
  displayName: "Ada Lovelace",
  username: "ada",
}

function circle(overrides: Partial<Circle> = {}): Circle {
  return {
    id: "circle-1",
    name: "studio crew",
    description: "",
    memberIds: [],
    type: "custom",
    memberAddedAt: {},
    ...overrides,
  }
}

function renderCirclesPage(apiBaseUrl = "https://api.sponti.test"): void {
  process.env.NEXT_PUBLIC_API_BASE_URL = apiBaseUrl
  render(<CirclesPage />)
}

describe("CirclesPage action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchAcceptedConnections.mockResolvedValue([ada])
    mocks.fetchIncomingConnectionRequests.mockResolvedValue([])
    mocks.fetchOutgoingConnectionRequests.mockResolvedValue([])
    mocks.fetchBlockedUsers.mockResolvedValue([])
    mocks.fetchMyCircles.mockResolvedValue([circle()])
    mocks.createCircle.mockResolvedValue(
      circle({ id: "circle-2", name: "book club" })
    )
    mocks.updateCircle.mockResolvedValue(circle({ name: "studio people" }))
    mocks.addCircleMember.mockResolvedValue(undefined)
    mocks.removeCircleMember.mockResolvedValue(undefined)
    mocks.searchUsers.mockResolvedValue([ada])
  })

  it("confirms when a circle is created", async () => {
    const user = userEvent.setup()
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: "create custom circle" })
    )
    await user.type(screen.getByPlaceholderText("studio crew"), "book club")
    await user.click(screen.getByRole("button", { name: "create circle" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("circle created")
    )
  })

  it("surfaces feedback when circle creation fails", async () => {
    const user = userEvent.setup()
    mocks.createCircle.mockRejectedValue(new Error("network went quiet"))
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: "create custom circle" })
    )
    await user.type(screen.getByPlaceholderText("studio crew"), "book club")
    await user.click(screen.getByRole("button", { name: "create circle" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't create circle",
        { tone: "error" }
      )
    )
  })

  it("does not rename or show feedback when a circle name is unchanged", async () => {
    const user = userEvent.setup()
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: /studio crew/i })
    )
    const name = screen.getByLabelText("circle name")
    await user.click(name)
    await user.tab()

    expect(mocks.updateCircle).not.toHaveBeenCalled()
    expect(mocks.showActionFeedback).not.toHaveBeenCalledWith("circle renamed")
  })

  it("surfaces feedback when circle rename fails", async () => {
    const user = userEvent.setup()
    mocks.updateCircle.mockRejectedValue(new Error("network went quiet"))
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: /studio crew/i })
    )
    const name = screen.getByLabelText("circle name")
    await user.clear(name)
    await user.type(name, "studio people")
    await user.tab()

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't rename circle",
        { tone: "error" }
      )
    )
  })

  it("surfaces feedback when moving a member fails after adding to the target", async () => {
    const user = userEvent.setup()
    mocks.fetchMyCircles.mockResolvedValue([
      circle({ id: "circle-1", name: "studio crew", memberIds: [ada.id] }),
      circle({ id: "circle-2", name: "book club" }),
    ])
    mocks.removeCircleMember.mockRejectedValue(new Error("network went quiet"))
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: /studio crew/i })
    )
    await user.click(
      await screen.findByRole("button", { name: "options for Ada Lovelace" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "move to book club" })
    )

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't move to circle",
        { tone: "error" }
      )
    )
  })

  it("surfaces feedback when sending a request without API config", async () => {
    const user = userEvent.setup()
    renderCirclesPage("")

    await user.click(screen.getByRole("tab", { name: "connections" }))
    await user.type(screen.getByPlaceholderText("add by @handle"), "ada")
    await user.click(await screen.findByRole("button", { name: "add" }))

    expect(mocks.showActionFeedback).toHaveBeenCalledWith(
      "couldn't send request",
      { tone: "error" }
    )
  })
})
