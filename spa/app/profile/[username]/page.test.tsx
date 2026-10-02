import { Suspense } from "react"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PublicProfilePage from "./page"
import type { UserProfile } from "@/lib/api/users"
import { HttpError } from "@/lib/http"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  showActionFeedback: vi.fn(),
  fetchUserProfile: vi.fn(),
  fetchMutualFriends: vi.fn(),
  auth: {
    user: { profileVisibility: "public" } as {
      profileVisibility: "public" | "private"
    } | null,
  },
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

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}))

vi.mock("@/lib/api/users", () => ({
  fetchUserProfile: mocks.fetchUserProfile,
  fetchMutualFriends: mocks.fetchMutualFriends,
}))

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
      bio: null,
      socials: { instagram: null, telegram: null },
    },
    relationship: "none",
    connectionId: null,
    mutualFriends: { count: 0, preview: [] },
    ...overrides,
  }
}

const friend = (username: string, displayName: string) => ({
  id: `id-${username}`,
  username,
  displayName,
  avatarUrl: null,
})

// What a connection (or anyone, on a public profile) gets back (#288).
function fullProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const base = profile({ relationship: "connected" })
  return {
    ...base,
    profile: {
      ...base.profile,
      bio: "climbing, coffee, late dinners",
      socials: { instagram: "sarah.kim", telegram: "sarahk" },
    },
    mutualFriends: {
      count: 4,
      preview: [
        friend("maya", "Maya Chen"),
        friend("noah", "Noah Weiss"),
        friend("ada", "Ada Okafor"),
      ],
    },
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
    mocks.auth.user = { profileVisibility: "public" }
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

    expect(
      await screen.findByRole("link", { name: "edit profile" })
    ).toBeInTheDocument()
    expect(screen.queryByText("this is you")).not.toBeInTheDocument()
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

  describe("bio, socials and mutual friends (#289)", () => {
    it("shows a connection's bio, socials as new-tab links, and mutual friends", async () => {
      mocks.fetchUserProfile.mockResolvedValue(fullProfile())

      await renderPage()

      expect(
        await screen.findByText("climbing, coffee, late dinners")
      ).toBeInTheDocument()
      const instagram = screen.getByRole("link", { name: /instagram/ })
      expect(instagram).toHaveAttribute(
        "href",
        "https://instagram.com/sarah.kim"
      )
      expect(instagram).toHaveAttribute("target", "_blank")
      expect(instagram).toHaveAttribute(
        "rel",
        expect.stringContaining("noopener")
      )
      const telegram = screen.getByRole("link", { name: /telegram/ })
      expect(telegram).toHaveAttribute("href", "https://t.me/sarahk")
      expect(telegram).toHaveAttribute("target", "_blank")
      expect(
        screen.getByRole("button", { name: /4 mutual friends/ })
      ).toBeInTheDocument()
      expect(screen.queryByText("no bio yet")).not.toBeInTheDocument()
    })

    it("shows only the handles that exist", async () => {
      const full = fullProfile()
      mocks.fetchUserProfile.mockResolvedValue({
        ...full,
        profile: {
          ...full.profile,
          socials: { instagram: null, telegram: "sarahk" },
        },
      })

      await renderPage()

      expect(
        await screen.findByRole("link", { name: /telegram/ })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: /instagram/ })
      ).not.toBeInTheDocument()
    })

    it("renders nothing extra when the api sends it all empty, with no hint of privacy", async () => {
      mocks.fetchUserProfile.mockResolvedValue(profile())

      await renderPage()

      expect(await screen.findByText("Sarah Kim")).toBeInTheDocument()
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
      expect(screen.queryByText(/mutual/)).not.toBeInTheDocument()
      expect(screen.queryByText(/private|bio|social|friends see/i)).toBeNull()
      expect(screen.queryByRole("button", { name: /mutual/ })).toBeNull()
    })

    it("lists every mutual friend on tap, each linking to their profile, and pages on demand", async () => {
      mocks.fetchUserProfile.mockResolvedValue(fullProfile())
      mocks.fetchMutualFriends
        .mockResolvedValueOnce({
          people: [friend("ada", "Ada Okafor"), friend("maya", "Maya Chen")],
          hasMore: true,
        })
        .mockResolvedValueOnce({
          people: [friend("noah", "Noah Weiss")],
          hasMore: false,
        })
      const user = userEvent.setup()

      await renderPage()
      await user.click(
        await screen.findByRole("button", { name: /4 mutual friends/ })
      )

      const dialog = await screen.findByRole("dialog", {
        name: "mutual friends",
      })
      expect(mocks.fetchMutualFriends).toHaveBeenCalledWith(
        "sarah",
        1,
        expect.any(AbortSignal)
      )
      const ada = await within(dialog).findByRole("link", {
        name: /Ada Okafor/,
      })
      expect(ada).toHaveAttribute("href", "/profile/ada")

      await user.click(
        within(dialog).getByRole("button", { name: "show more" })
      )
      expect(
        await within(dialog).findByRole("link", { name: /Noah Weiss/ })
      ).toHaveAttribute("href", "/profile/noah")
      expect(mocks.fetchMutualFriends).toHaveBeenLastCalledWith(
        "sarah",
        2,
        expect.any(AbortSignal)
      )
      expect(
        within(dialog).queryByRole("button", { name: "show more" })
      ).not.toBeInTheDocument()

      await user.click(within(dialog).getByRole("button", { name: "close" }))
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("says so when the list can't load, and retries", async () => {
      mocks.fetchUserProfile.mockResolvedValue(fullProfile())
      mocks.fetchMutualFriends
        .mockRejectedValueOnce(new HttpError(503, "down"))
        .mockResolvedValueOnce({
          people: [friend("ada", "Ada Okafor")],
          hasMore: false,
        })
      const user = userEvent.setup()

      await renderPage()
      await user.click(
        await screen.findByRole("button", { name: /4 mutual friends/ })
      )
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "couldn't load the list"
      )
      await user.click(screen.getByRole("button", { name: "try again" }))

      expect(
        await screen.findByRole("link", { name: /Ada Okafor/ })
      ).toBeInTheDocument()
    })

    it("uses the singular for one mutual friend", async () => {
      mocks.fetchUserProfile.mockResolvedValue(
        fullProfile({
          mutualFriends: { count: 1, preview: [friend("maya", "Maya Chen")] },
        })
      )

      await renderPage()

      expect(
        await screen.findByRole("button", { name: "1 mutual friend" })
      ).toBeInTheDocument()
    })

    it("on your own profile shows a private pill, edit profile, and no mutual friends", async () => {
      mocks.auth.user = { profileVisibility: "private" }
      mocks.fetchUserProfile.mockResolvedValue(
        fullProfile({ relationship: "self" })
      )

      await renderPage()

      expect(
        await screen.findByText("private · not in search")
      ).toBeInTheDocument()
      expect(
        screen.getByRole("link", { name: "edit profile" })
      ).toHaveAttribute("href", "/settings/profile")
      expect(
        screen.getByText("climbing, coffee, late dinners")
      ).toBeInTheDocument()
      expect(screen.queryByText(/mutual/)).not.toBeInTheDocument()
    })

    it("on your own public profile says public, and nudges an empty bio", async () => {
      mocks.fetchUserProfile.mockResolvedValue(
        profile({ relationship: "self" })
      )

      await renderPage()

      expect(await screen.findByText("public · in search")).toBeInTheDocument()
      expect(screen.getByText("no bio yet")).toBeInTheDocument()
    })

    it("never shows the visibility pill or edit link on someone else's profile", async () => {
      mocks.auth.user = { profileVisibility: "private" }
      mocks.fetchUserProfile.mockResolvedValue(fullProfile())

      await renderPage()

      await screen.findByText("Sarah Kim")
      expect(screen.queryByText(/not in search|in search/)).toBeNull()
      expect(screen.queryByRole("link", { name: "edit profile" })).toBeNull()
    })
  })
})
