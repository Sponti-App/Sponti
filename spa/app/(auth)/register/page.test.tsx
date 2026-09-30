import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RegisterPage from "./page"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  register: vi.fn(),
  fetchContactPreviewName: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ register: mocks.register, loginWithGoogle: vi.fn() }),
}))

vi.mock("@/components/google-auth-button", () => ({
  GoogleAuthButton: () => null,
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
    expect(screen.getByText("Claim your handle.")).toBeInTheDocument()
  })

  it("does not look anything up without a contact link", async () => {
    visit("?redirectTo=%2Fcircles")

    render(<RegisterPage />)

    expect(screen.getByText("Claim your handle.")).toBeInTheDocument()
    expect(mocks.fetchContactPreviewName).not.toHaveBeenCalled()
  })
})

describe("RegisterPage legal links (#129)", () => {
  it("links the terms and the privacy note", () => {
    visit("")

    render(<RegisterPage />)

    expect(screen.getByText(/by signing up you agree to the/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "terms" })).toHaveAttribute(
      "href",
      "/menu/terms"
    )
    expect(screen.getByRole("link", { name: "privacy note" })).toHaveAttribute(
      "href",
      "/menu/privacy"
    )
  })
})
