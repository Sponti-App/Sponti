import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CirclesPage from "./page"
import type { Circle, Connection } from "@/lib/circles"

const mocks = vi.hoisted(() => ({
  addCircleMember: vi.fn(),
  createCircle: vi.fn(),
  fetchAcceptedConnections: vi.fn(),
  fetchBlockedUsers: vi.fn(),
  fetchCircleFlares: vi.fn(),
  inviteEventGuests: vi.fn(),
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
    fetchCircleFlares: (...args: unknown[]) =>
      mocks.fetchCircleFlares(...args) ?? Promise.resolve([]),
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

vi.mock("@/lib/api/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/events")>()
  return {
    ...actual,
    inviteEventGuests: mocks.inviteEventGuests,
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

// #156: adding a friend to a circle used to need typing a name first.
describe("CirclesPage add friends to a circle", () => {
  const bob: Connection = {
    id: "user-2",
    displayName: "Bob Ross",
    username: "bob",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchAcceptedConnections.mockResolvedValue([ada, bob])
    mocks.fetchIncomingConnectionRequests.mockResolvedValue([])
    mocks.fetchOutgoingConnectionRequests.mockResolvedValue([])
    mocks.fetchBlockedUsers.mockResolvedValue([])
    mocks.addCircleMember.mockResolvedValue(undefined)
  })

  it("lists friends who aren't in the circle without typing, and adds on tap", async () => {
    const user = userEvent.setup()
    mocks.fetchMyCircles.mockResolvedValue([circle({ memberIds: [ada.id] })])
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: /studio crew/i })
    )

    // Bob is offered straight away; Ada is already a member, so she isn't.
    const bobRow = await screen.findByRole("button", { name: /Bob Ross/ })
    const addSection = screen
      .getByPlaceholderText("add a friend…")
      .closest("div.flex-col") as HTMLElement
    expect(
      within(addSection).queryByRole("button", { name: /Ada Lovelace/ })
    ).not.toBeInTheDocument()

    await user.click(bobRow)
    expect(mocks.addCircleMember).toHaveBeenCalledWith("circle-1", bob.id)
  })

  it("still narrows the list with the search field", async () => {
    const user = userEvent.setup()
    mocks.fetchMyCircles.mockResolvedValue([circle()])
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: /studio crew/i })
    )
    await user.type(screen.getByPlaceholderText("add a friend…"), "ada")

    expect(
      await screen.findByRole("button", { name: /Ada Lovelace/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Bob Ross/ })
    ).not.toBeInTheDocument()
  })

  it("says so when everyone is already in the circle", async () => {
    const user = userEvent.setup()
    mocks.fetchMyCircles.mockResolvedValue([
      circle({ memberIds: [ada.id, bob.id] }),
    ])
    renderCirclesPage()

    await user.click(
      await screen.findByRole("button", { name: /studio crew/i })
    )

    expect(
      await screen.findByText("everyone's already in this circle")
    ).toBeInTheDocument()
  })
})

// #150: circles are snapshots, so someone added to a circle later isn't on the
// flares it was already invited to. Offer to add them, opt-in.
describe("CirclesPage add to flares prompt", () => {
  const bob: Connection = {
    id: "user-2",
    displayName: "Bob Ross",
    username: "bob",
  }
  const flares = [
    {
      id: "flare-1",
      title: "friday drinks",
      startAt: "2099-06-05T18:00:00.000Z",
      endAt: "2099-06-05T21:00:00.000Z",
    },
    {
      id: "flare-2",
      title: "sunday run",
      startAt: "2099-06-07T08:00:00.000Z",
      endAt: "2099-06-07T09:00:00.000Z",
    },
  ]

  async function addBobToStudioCrew(user: ReturnType<typeof userEvent.setup>) {
    renderCirclesPage()
    await user.click(
      await screen.findByRole("button", { name: /studio crew/i })
    )
    await user.click(await screen.findByRole("button", { name: /Bob Ross/ }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchAcceptedConnections.mockResolvedValue([ada, bob])
    mocks.fetchIncomingConnectionRequests.mockResolvedValue([])
    mocks.fetchOutgoingConnectionRequests.mockResolvedValue([])
    mocks.fetchBlockedUsers.mockResolvedValue([])
    mocks.fetchMyCircles.mockResolvedValue([circle({ memberIds: [ada.id] })])
    mocks.addCircleMember.mockResolvedValue(undefined)
    mocks.fetchCircleFlares.mockResolvedValue(flares)
    mocks.inviteEventGuests.mockResolvedValue({ invitedUserIds: [bob.id] })
  })

  it("offers the circle's upcoming flares, all ticked, and adds the person to them", async () => {
    const user = userEvent.setup()
    await addBobToStudioCrew(user)

    const dialog = await screen.findByRole("dialog", {
      name: "add Bob Ross to your flares too?",
    })
    expect(mocks.fetchCircleFlares).toHaveBeenCalledWith("circle-1", "user-2")
    expect(
      within(dialog).getByText("studio crew is invited to 2 upcoming flares")
    ).toBeInTheDocument()
    const boxes = within(dialog).getAllByRole("checkbox")
    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual([
      "true",
      "true",
    ])

    await user.click(
      within(dialog).getByRole("button", { name: "add to flares" })
    )

    await waitFor(() =>
      expect(mocks.inviteEventGuests).toHaveBeenCalledTimes(2)
    )
    expect(mocks.inviteEventGuests).toHaveBeenCalledWith("flare-1", {
      members: [{ userId: "user-2", role: "guest" }],
    })
    expect(mocks.inviteEventGuests).toHaveBeenCalledWith("flare-2", {
      members: [{ userId: "user-2", role: "guest" }],
    })
    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "added Bob Ross to 2 flares"
      )
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("only adds them to the flares that are still ticked", async () => {
    const user = userEvent.setup()
    await addBobToStudioCrew(user)

    const dialog = await screen.findByRole("dialog")
    await user.click(
      within(dialog).getByRole("checkbox", { name: /sunday run/ })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "add to flares" })
    )

    await waitFor(() =>
      expect(mocks.inviteEventGuests).toHaveBeenCalledTimes(1)
    )
    expect(mocks.inviteEventGuests).toHaveBeenCalledWith(
      "flare-1",
      expect.anything()
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith(
      "added Bob Ross to the flare"
    )
  })

  it("does nothing to the flares when the host picks just the circle", async () => {
    const user = userEvent.setup()
    await addBobToStudioCrew(user)

    await user.click(
      await screen.findByRole("button", { name: "just the circle" })
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.inviteEventGuests).not.toHaveBeenCalled()
    // He was still added to the circle itself.
    expect(mocks.addCircleMember).toHaveBeenCalledWith("circle-1", "user-2")
  })

  it("can't add to flares with nothing ticked", async () => {
    const user = userEvent.setup()
    await addBobToStudioCrew(user)

    const dialog = await screen.findByRole("dialog")
    for (const box of within(dialog).getAllByRole("checkbox"))
      await user.click(box)

    expect(
      within(dialog).getByRole("button", { name: "add to flares" })
    ).toBeDisabled()
  })

  it("doesn't ask when the circle has no upcoming flares", async () => {
    const user = userEvent.setup()
    mocks.fetchCircleFlares.mockResolvedValue([])
    await addBobToStudioCrew(user)

    await waitFor(() => expect(mocks.fetchCircleFlares).toHaveBeenCalled())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("stays quiet if the flares can't be loaded", async () => {
    const user = userEvent.setup()
    mocks.fetchCircleFlares.mockRejectedValue(new Error("offline"))
    await addBobToStudioCrew(user)

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("added to circle")
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.showActionFeedback).not.toHaveBeenCalledWith(
      expect.anything(),
      { tone: "error" }
    )
  })

  it("says so when some of the flares couldn't take them", async () => {
    const user = userEvent.setup()
    mocks.inviteEventGuests
      .mockResolvedValueOnce({ invitedUserIds: [bob.id] })
      .mockRejectedValueOnce(new Error("that flare has ended"))
    await addBobToStudioCrew(user)

    await user.click(
      await screen.findByRole("button", { name: "add to flares" })
    )

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't add them to every flare",
        { tone: "error" }
      )
    )
  })
})
