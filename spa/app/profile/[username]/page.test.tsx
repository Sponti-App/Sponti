import { Suspense } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PublicProfilePage from "./page"
import type { UserProfile } from "@/lib/api/users"
import { HttpError } from "@/lib/http"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  showActionFeedback: vi.fn(),
  fetchUserProfile: vi.fn(),
  sendConnectionRequest: vi.fn(),
  respondToConnectionRequest: vi.fn(),
  deleteConnection: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back, push: vi.fn() }),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: mocks.showActionFeedback }),
}))

vi.mock("@/lib/api/users", () => ({ fetchUserProfile: mocks.fetchUserProfile }))

vi.mock("@/lib/api/connections", () => ({
  sendConnectionRequest: mocks.sendConnectionRequest,
  respondToConnectionRequest: mocks.respondToConnectionRequest,
  deleteConnection: mocks.deleteConnection,
}))

vi.mock("@/lib/api/blocks", () => ({
  blockUser: mocks.blockUser,
  unblockUser: mocks.unblockUser,
}))

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    profile: {
      id: "host-1",
      username: "sarah",
      displayName: "Sarah Kim",
      avatarUrl: null,
    },
    relationship: "none",
    connectionId: null,
    ...overrides,
  }
}

async function renderPage(username = "sarah") {
  const params = Promise.resolve({ username })
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PublicProfilePage params={params} />
      </Suspense>
    )
  })
}

// #199: the page asks the api who this is and how the viewer stands with
// them, instead of guessing from the viewer's own connection lists.
describe("PublicProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.test")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("shows a stranger (a public flare's host) with an add friend action, not 'user not found'", async () => {
    mocks.fetchUserProfile.mockResolvedValue(profile())
    mocks.sendConnectionRequest.mockResolvedValue(undefined)
    const user = userEvent.setup()

    await renderPage()

    expect(await screen.findByText("Sarah Kim")).toBeInTheDocument()
    expect(screen.getByText("@sarah")).toBeInTheDocument()
    expect(screen.queryByText("user not found")).not.toBeInTheDocument()
    expect(mocks.fetchUserProfile).toHaveBeenCalledWith(
      "sarah",
      expect.any(AbortSignal)
    )

    mocks.fetchUserProfile.mockResolvedValue(
      profile({ relationship: "pending_outgoing", connectionId: "conn-1" })
    )
    await user.click(screen.getByRole("button", { name: "add friend" }))

    expect(mocks.sendConnectionRequest).toHaveBeenCalledWith("host-1")
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("request sent")
    expect(
      await screen.findByRole("button", { name: "cancel request" })
    ).toBeInTheDocument()
  })

  it("shows a loading state until the api answers", async () => {
    mocks.fetchUserProfile.mockReturnValue(new Promise(() => {}))

    await renderPage()

    expect(screen.getByLabelText("loading profile")).toBeInTheDocument()
    expect(screen.queryByText("user not found")).not.toBeInTheDocument()
  })

  it("says not found when the api does (unknown user, or one who blocked you)", async () => {
    mocks.fetchUserProfile.mockRejectedValue(
      new HttpError(404, "User not found", "USER_NOT_FOUND")
    )

    await renderPage("ghost")

    expect(await screen.findByText("user not found")).toBeInTheDocument()
    expect(screen.getByText("@ghost")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "add friend" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "options" })
    ).not.toBeInTheDocument()
  })

  it("offers a retry on any other error, rather than claiming the user doesn't exist", async () => {
    mocks.fetchUserProfile
      .mockRejectedValueOnce(new HttpError(503, "down"))
      .mockResolvedValueOnce(profile())
    const user = userEvent.setup()

    await renderPage()

    expect(
      await screen.findByText("couldn't load this profile")
    ).toBeInTheDocument()
    expect(screen.queryByText("user not found")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "try again" }))
    expect(await screen.findByText("Sarah Kim")).toBeInTheDocument()
  })

  it("shows a connection as a friend, with block in the options menu", async () => {
    mocks.fetchUserProfile.mockResolvedValue(
      profile({ relationship: "connected" })
    )

    await renderPage()

    expect(await screen.findByText("you're friends")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "options" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "add friend" })
    ).not.toBeInTheDocument()
  })

  it("cancels a sent request and goes back, as before", async () => {
    mocks.fetchUserProfile.mockResolvedValue(
      profile({ relationship: "pending_outgoing", connectionId: "conn-1" })
    )
    mocks.deleteConnection.mockResolvedValue(undefined)
    const user = userEvent.setup()

    await renderPage()
    await user.click(
      await screen.findByRole("button", { name: "cancel request" })
    )

    expect(mocks.deleteConnection).toHaveBeenCalledWith("conn-1")
    expect(mocks.back).toHaveBeenCalled()
  })

  it("lets you accept a request they sent you", async () => {
    mocks.fetchUserProfile.mockResolvedValue(
      profile({ relationship: "pending_incoming", connectionId: "conn-2" })
    )
    mocks.respondToConnectionRequest.mockResolvedValue(undefined)
    const user = userEvent.setup()

    await renderPage()
    expect(await screen.findByText("wants to be friends")).toBeInTheDocument()
    mocks.fetchUserProfile.mockResolvedValue(
      profile({ relationship: "connected" })
    )
    await user.click(screen.getByRole("button", { name: "accept request" }))

    expect(mocks.respondToConnectionRequest).toHaveBeenCalledWith(
      "conn-2",
      "accepted"
    )
    expect(await screen.findByText("you're friends")).toBeInTheDocument()
  })

  it("lets you unblock someone you blocked, and offers nothing else", async () => {
    mocks.fetchUserProfile.mockResolvedValue(
      profile({ relationship: "blocked" })
    )
    mocks.unblockUser.mockResolvedValue(undefined)
    const user = userEvent.setup()

    await renderPage()
    await user.click(await screen.findByRole("button", { name: "unblock" }))

    expect(
      screen.queryByRole("button", { name: "options" })
    ).not.toBeInTheDocument()
    expect(mocks.unblockUser).toHaveBeenCalledWith("host-1")
    expect(mocks.back).toHaveBeenCalled()
  })

  it("shows your own profile with no actions", async () => {
    mocks.fetchUserProfile.mockResolvedValue(profile({ relationship: "self" }))

    await renderPage()

    expect(await screen.findByText("this is you")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "options" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: /add friend|unblock|cancel request/,
      })
    ).not.toBeInTheDocument()
  })

  it("keeps the page on a failed action and says so", async () => {
    mocks.fetchUserProfile.mockResolvedValue(profile())
    mocks.sendConnectionRequest.mockRejectedValue(
      new HttpError(409, "rejected")
    )
    const user = userEvent.setup()

    await renderPage()
    await user.click(await screen.findByRole("button", { name: "add friend" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't send request",
        {
          tone: "error",
        }
      )
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      "couldn't send request. try again."
    )
    expect(mocks.back).not.toHaveBeenCalled()
  })
})
