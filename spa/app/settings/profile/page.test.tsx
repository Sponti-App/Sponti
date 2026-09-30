import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import EditProfilePage from "./page"
import { getUser, setSession, type AuthUser } from "@/lib/auth-store"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  showActionFeedback: vi.fn(),
  updateProfile: vi.fn(),
  me: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back }),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: mocks.showActionFeedback }),
}))

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    username: "martin",
    displayName: "Martin",
    email: "martin@sponti.test",
    avatarUrl: null,
    profileVisibility: "public",
    socialBattery: 100,
    bio: null,
    instagram: null,
    telegram: null,
    createdAt: "2099-01-01T00:00:00.000Z",
    updatedAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  }
}

let currentUser: AuthUser = baseUser()

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: currentUser }),
}))

vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>()
  return { ...actual, updateProfile: mocks.updateProfile, me: mocks.me }
})

const LEGACY_KEY = "sponti.profile.extras.v1"

const bio = () => screen.getByRole("textbox", { name: "bio" })
const instagram = () => screen.getByRole("textbox", { name: "instagram" })
const telegram = () => screen.getByRole("textbox", { name: "telegram" })
const save = () => screen.getByRole("button", { name: "save changes" })

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  currentUser = baseUser()
  mocks.updateProfile.mockResolvedValue({ user: baseUser() })
})

afterEach(() => window.localStorage.clear())

describe("EditProfilePage", () => {
  it("starts from the saved values, with save off until something changes", () => {
    currentUser = baseUser({
      bio: "climbing, coffee",
      instagram: "sarah.kim",
      telegram: "sarahkim",
    })
    render(<EditProfilePage />)

    expect(bio()).toHaveValue("climbing, coffee")
    expect(instagram()).toHaveValue("sarah.kim")
    expect(telegram()).toHaveValue("sarahkim")
    expect(screen.getByText("16/80")).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it("reads the fields from GET /auth/me when the session lacks them", async () => {
    currentUser = baseUser({
      bio: undefined,
      instagram: undefined,
      telegram: undefined,
    })
    mocks.me.mockResolvedValue({ user: baseUser({ bio: "hi there" }) })
    render(<EditProfilePage />)

    expect(bio()).toBeDisabled()
    await waitFor(() => expect(bio()).toHaveValue("hi there"))
    expect(bio()).toBeEnabled()
  })

  it("counts the bio and turns line breaks into spaces", async () => {
    const user = userEvent.setup()
    render(<EditProfilePage />)

    await user.click(bio())
    await user.paste("coffee\n\nclimbing")
    expect(bio()).toHaveValue("coffee climbing")
    expect(screen.getByText("15/80")).toBeInTheDocument()

    // Enter does not add a line.
    await user.keyboard("{Enter}")
    expect(bio()).toHaveValue("coffee climbing")
  })

  it("flags a bio over 80 characters and does not save it", async () => {
    const user = userEvent.setup()
    render(<EditProfilePage />)

    await user.click(bio())
    await user.paste("x".repeat(81))
    expect(screen.getByText("81/80")).toBeInTheDocument()
    await user.click(save())

    expect(
      await screen.findByText("bio must be 80 characters or fewer")
    ).toBeInTheDocument()
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })

  it("shows the stored handle live for @handle and pasted links", async () => {
    const user = userEvent.setup()
    render(<EditProfilePage />)

    await user.type(instagram(), "@Sarah.Kim")
    expect(
      screen.getByText("shows as @sarah.kim · instagram.com/sarah.kim")
    ).toBeInTheDocument()

    await user.type(telegram(), "https://t.me/SarahKim/")
    expect(
      screen.getByText("shows as @sarahkim · t.me/sarahkim")
    ).toBeInTheDocument()
  })

  it("explains an invalid handle once the field is left", async () => {
    const user = userEvent.setup()
    render(<EditProfilePage />)

    await user.type(telegram(), "abc")
    expect(
      screen.queryByText(/telegram handle must be/)
    ).not.toBeInTheDocument()
    await user.tab()

    expect(
      screen.getByText(/^telegram handle must be 5–32 letters/)
    ).toBeInTheDocument()
    expect(telegram()).toHaveAttribute("aria-invalid", "true")
  })

  it("saves only what changed, normalised, through PATCH /auth/me/profile", async () => {
    const user = userEvent.setup()
    mocks.updateProfile.mockResolvedValue({
      user: baseUser({ bio: "coffee", instagram: "sarah.kim" }),
    })
    render(<EditProfilePage />)

    await user.type(bio(), "  coffee  ")
    await user.type(instagram(), "https://www.instagram.com/Sarah.Kim/?igsh=1")
    await user.click(save())

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        bio: "coffee",
        instagram: "sarah.kim",
      })
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("profile saved")
    // The form now shows what the server stored, and save is off again.
    expect(instagram()).toHaveValue("sarah.kim")
    expect(save()).toBeDisabled()
  })

  it("updates the stored session user with what the server returned", async () => {
    const user = userEvent.setup()
    setSession("access", "refresh", baseUser())
    mocks.updateProfile.mockResolvedValue({
      user: baseUser({
        bio: "coffee",
        instagram: "sarah.kim",
        updatedAt: "2099-02-02T00:00:00.000Z",
      }),
    })
    render(<EditProfilePage />)

    await user.type(bio(), "coffee")
    await user.click(save())

    await waitFor(() => expect(getUser()?.bio).toBe("coffee"))
    expect(getUser()).toMatchObject({
      instagram: "sarah.kim",
      updatedAt: "2099-02-02T00:00:00.000Z",
    })
  })

  it("clears a field by sending null", async () => {
    const user = userEvent.setup()
    currentUser = baseUser({ bio: "old bio", telegram: "sarahkim" })
    mocks.updateProfile.mockResolvedValue({
      user: baseUser({ telegram: "sarahkim" }),
    })
    render(<EditProfilePage />)

    await user.clear(bio())
    await user.click(save())

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({ bio: null })
    )
  })

  it("does not treat a retyped-but-identical handle as a change", async () => {
    const user = userEvent.setup()
    currentUser = baseUser({ instagram: "sarah.kim" })
    render(<EditProfilePage />)

    await user.clear(instagram())
    await user.type(instagram(), "@Sarah.Kim")

    expect(save()).toBeDisabled()
  })

  it("shows the server's validation error against its field", async () => {
    const user = userEvent.setup()
    mocks.updateProfile.mockRejectedValue(
      new Error(
        "✖ Telegram handle must be 5–32 letters, numbers or underscores, starting with a letter\n  → at telegram"
      )
    )
    render(<EditProfilePage />)

    await user.type(telegram(), "sarahkim")
    await user.click(save())

    expect(
      await screen.findByText(
        "telegram handle must be 5–32 letters, numbers or underscores, starting with a letter"
      )
    ).toBeInTheDocument()
    expect(mocks.showActionFeedback).toHaveBeenCalledWith(
      "couldn't save that",
      {
        tone: "error",
      }
    )
    // Editing the field clears its server error.
    await user.type(telegram(), "x")
    expect(
      screen.queryByText(/starting with a letter$/)
    ).not.toBeInTheDocument()
  })

  it("shows other server errors under the form", async () => {
    const user = userEvent.setup()
    mocks.updateProfile.mockRejectedValue(new Error("Network went quiet"))
    render(<EditProfilePage />)

    await user.type(bio(), "hi")
    await user.click(save())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "network went quiet"
    )
  })
})

describe("import handles from this device", () => {
  const seedLegacy = (entry: Record<string, string>, userId = "user-1") =>
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ [userId]: entry }))

  it("offers nothing when the device holds no handles", () => {
    render(<EditProfilePage />)
    expect(screen.queryByText(/saved on this device/)).not.toBeInTheDocument()
  })

  it("fills the form on accept, saves nothing, and forgets the device copy", async () => {
    const user = userEvent.setup()
    seedLegacy({ instagram: "old.insta", telegram: "oldtelegram" })
    render(<EditProfilePage />)

    expect(
      screen.getByText(/found handles saved on this device/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/instagram old\.insta · telegram oldtelegram/)
    ).toBeInTheDocument()
    // Offering is not importing.
    expect(instagram()).toHaveValue("")

    await user.click(screen.getByRole("button", { name: "add them" }))

    expect(instagram()).toHaveValue("old.insta")
    expect(telegram()).toHaveValue("oldtelegram")
    expect(mocks.updateProfile).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(screen.queryByText(/found handles saved/)).not.toBeInTheDocument()
    // Only pressing save sends them.
    await user.click(save())
    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        instagram: "old.insta",
        telegram: "oldtelegram",
      })
    )
  })

  it("forgets the device copy on dismiss, leaving the form empty", async () => {
    const user = userEvent.setup()
    seedLegacy({ instagram: "old.insta", telegram: "" })
    render(<EditProfilePage />)

    await user.click(screen.getByRole("button", { name: "no thanks" }))

    expect(instagram()).toHaveValue("")
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(screen.queryByText(/found handles saved/)).not.toBeInTheDocument()
  })

  it("never overwrites a handle the account already has", async () => {
    const user = userEvent.setup()
    currentUser = baseUser({ instagram: "real.one" })
    seedLegacy({ instagram: "old.insta", telegram: "oldtelegram" })
    render(<EditProfilePage />)

    expect(screen.getByText(/telegram oldtelegram/)).toBeInTheDocument()
    expect(screen.queryByText(/old\.insta/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "add them" }))

    expect(instagram()).toHaveValue("real.one")
    expect(telegram()).toHaveValue("oldtelegram")
  })

  it("quietly forgets device handles when the account has its own already", async () => {
    currentUser = baseUser({ instagram: "real.one", telegram: "realtelegram" })
    seedLegacy({ instagram: "old.insta", telegram: "oldtelegram" })
    render(<EditProfilePage />)

    await waitFor(() =>
      expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
    )
    expect(screen.queryByText(/found handles saved/)).not.toBeInTheDocument()
  })

  it("ignores another account's handles on a shared device", () => {
    seedLegacy({ instagram: "theirs", telegram: "" }, "someone-else")
    render(<EditProfilePage />)

    expect(screen.queryByText(/found handles saved/)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })
})
