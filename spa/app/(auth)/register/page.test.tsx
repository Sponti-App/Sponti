import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REGISTER_DRAFT_KEY } from "@/lib/register-draft"
import RegisterPage from "./page"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  register: vi.fn(),
  loginWithGoogle: vi.fn(),
  fetchContactPreviewName: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    register: mocks.register,
    loginWithGoogle: mocks.loginWithGoogle,
  }),
}))

vi.mock("@/components/google-auth-button", () => ({
  GoogleAuthButton: ({
    onCredential,
  }: {
    onCredential: (credential: string) => void
  }) => (
    <button type="button" onClick={() => onCredential("google-credential")}>
      google stub
    </button>
  ),
}))

vi.mock("@/lib/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/http")>()),
  warmBackends: vi.fn(),
}))

vi.mock("@/lib/api/contact-preview", () => ({
  fetchContactPreviewName: mocks.fetchContactPreviewName,
}))

function visit(search: string) {
  window.history.replaceState(null, "", `/register${search}`)
}

describe("RegisterPage from a contact link (#124)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.register.mockResolvedValue(undefined)
  })

  afterEach(() => {
    window.history.replaceState(null, "", "/")
  })

  it("names the inviter and returns to the link after registering", async () => {
    mocks.fetchContactPreviewName.mockResolvedValue("Alex")
    visit("?redirectTo=%2Finvite%2Fabc123")
    const user = userEvent.setup()

    render(<RegisterPage />)

    expect(await screen.findByText("join Alex on sponti")).toBeInTheDocument()
    expect(mocks.fetchContactPreviewName).toHaveBeenCalledWith(
      "invite",
      "abc123",
      expect.any(AbortSignal)
    )
    expect(screen.getByRole("link", { name: "sign in" })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Finvite%2Fabc123"
    )

    await user.type(screen.getByLabelText("your name"), "Sam")
    await user.type(screen.getByLabelText("username"), "sam")
    await user.type(screen.getByLabelText("email"), "sam@example.com")
    await user.type(screen.getByLabelText("password"), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/invite/abc123")
    )
  })

  it("keeps the generic copy when the link isn't live", async () => {
    mocks.fetchContactPreviewName.mockResolvedValue(null)
    visit("?redirectTo=%2Fqr%2Fexpired")

    render(<RegisterPage />)

    await waitFor(() =>
      expect(mocks.fetchContactPreviewName).toHaveBeenCalledWith(
        "qr",
        "expired",
        expect.any(AbortSignal)
      )
    )
    expect(screen.queryByText(/on sponti$/)).not.toBeInTheDocument()
    expect(screen.getByText("claim your handle")).toBeInTheDocument()
  })

  it("does not look anything up without a contact link", async () => {
    visit("?redirectTo=%2Fcircles")

    render(<RegisterPage />)

    expect(screen.getByText("claim your handle")).toBeInTheDocument()
    expect(mocks.fetchContactPreviewName).not.toHaveBeenCalled()
  })
})

describe("RegisterPage legal links (#129)", () => {
  it("links the terms and the privacy note", () => {
    visit("")

    render(<RegisterPage />)

    expect(
      screen.getByText(/by signing up you agree to the/)
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "terms" })).toHaveAttribute(
      "href",
      "/menu/terms"
    )
    expect(screen.getByRole("link", { name: "privacy note" })).toHaveAttribute(
      "href",
      "/menu/privacy"
    )
    expect(screen.getByRole("link", { name: "impressum" })).toHaveAttribute(
      "href",
      "/menu/impressum"
    )
  })
})

describe("RegisterPage draft across the legal pages (#300)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.register.mockResolvedValue(undefined)
    window.sessionStorage.clear()
    visit("")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
    window.history.replaceState(null, "", "/")
  })

  it("saves name, username and email as they're typed, never the password", async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText("your name"), "Sam")
    await user.type(screen.getByLabelText("username"), "sam")
    await user.type(screen.getByLabelText("email"), "sam@example.com")
    await user.type(screen.getByLabelText("password"), "password123")

    const stored = window.sessionStorage.getItem(REGISTER_DRAFT_KEY) ?? ""
    expect(JSON.parse(stored)).toEqual({
      displayName: "Sam",
      username: "sam",
      email: "sam@example.com",
    })
    expect(stored).not.toContain("password123")
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i) ?? ""
      expect(window.sessionStorage.getItem(key)).not.toContain("password123")
    }
  })

  it("restores the draft on a return visit, with an empty password", async () => {
    window.sessionStorage.setItem(
      REGISTER_DRAFT_KEY,
      JSON.stringify({
        displayName: "Sam",
        username: "sam",
        email: "sam@example.com",
      })
    )

    render(<RegisterPage />)

    expect(await screen.findByDisplayValue("Sam")).toBe(
      screen.getByLabelText("your name")
    )
    expect(screen.getByLabelText("username")).toHaveValue("sam")
    expect(screen.getByLabelText("email")).toHaveValue("sam@example.com")
    expect(screen.getByLabelText("password")).toHaveValue("")
    expect(screen.getByText("@sam")).toBeInTheDocument()
  })

  it("still validates a restored username", async () => {
    window.sessionStorage.setItem(
      REGISTER_DRAFT_KEY,
      JSON.stringify({ displayName: "Sam", username: "s!", email: "" })
    )

    render(<RegisterPage />)

    expect(
      await screen.findByText("use at least 3 characters")
    ).toBeInTheDocument()
  })

  it("clears the draft after a successful sign-up", async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText("your name"), "Sam")
    await user.type(screen.getByLabelText("username"), "sam")
    await user.type(screen.getByLabelText("email"), "sam@example.com")
    await user.type(screen.getByLabelText("password"), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() => expect(mocks.replace).toHaveBeenCalled())
    expect(window.sessionStorage.getItem(REGISTER_DRAFT_KEY)).toBeNull()
  })

  it("clears the draft after a Google sign-up", async () => {
    mocks.loginWithGoogle.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText("your name"), "Sam")
    expect(window.sessionStorage.getItem(REGISTER_DRAFT_KEY)).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "google stub" }))

    await waitFor(() => expect(mocks.replace).toHaveBeenCalled())
    expect(window.sessionStorage.getItem(REGISTER_DRAFT_KEY)).toBeNull()
  })

  it("keeps the draft when sign-up fails", async () => {
    mocks.register.mockRejectedValue(new Error("offline"))
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText("your name"), "Sam")
    await user.type(screen.getByLabelText("username"), "sam")
    await user.type(screen.getByLabelText("email"), "sam@example.com")
    await user.type(screen.getByLabelText("password"), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    expect(
      await screen.findByText("something went wrong, try again")
    ).toBeInTheDocument()
    expect(window.sessionStorage.getItem(REGISTER_DRAFT_KEY)).not.toBeNull()
  })

  it("renders and submits normally when sessionStorage throws", async () => {
    const boom = () => {
      throw new Error("SecurityError")
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom)
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom)
    const user = userEvent.setup()

    render(<RegisterPage />)

    await user.type(screen.getByLabelText("your name"), "Sam")
    await user.type(screen.getByLabelText("username"), "sam")
    await user.type(screen.getByLabelText("email"), "sam@example.com")
    await user.type(screen.getByLabelText("password"), "password123")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    await waitFor(() =>
      expect(mocks.register).toHaveBeenCalledWith({
        displayName: "Sam",
        username: "sam",
        email: "sam@example.com",
        password: "password123",
      })
    )
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"))
  })
})
