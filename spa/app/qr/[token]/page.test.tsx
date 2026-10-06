import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import QrContactPage from "./page"
import { HttpError } from "@/lib/http"
import type { QrContactResolveResult } from "@/lib/api/qr-contact-tokens"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  resolveQrContactToken: vi.fn(),
  fetchContactPreviewName: vi.fn(),
  showActionFeedback: vi.fn(),
  status: "authenticated" as "authenticated" | "unauthenticated",
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "qr-token" }),
  useRouter: () => ({
    back: mocks.back,
    push: mocks.push,
    replace: mocks.replace,
  }),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ status: mocks.status }),
}))

vi.mock("@/lib/api/contact-preview", () => ({
  fetchContactPreviewName: mocks.fetchContactPreviewName,
}))

vi.mock("@/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http")>()
  return { ...actual, warmBackends: vi.fn() }
})

vi.mock("@/lib/api/qr-contact-tokens", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/qr-contact-tokens")>()
  return {
    ...actual,
    resolveQrContactToken: mocks.resolveQrContactToken,
  }
})

function qrResult(
  overrides: Partial<QrContactResolveResult> = {}
): QrContactResolveResult {
  return {
    profile: {
      id: "user-2",
      username: "nil",
      displayName: "Nil",
    },
    relationship: "none",
    canConnect: true,
    expiresAt: "2099-05-21T12:00:00.000Z",
    connection: null,
    ...overrides,
  }
}

describe("QrContactPage action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = "authenticated"
    mocks.resolveQrContactToken
      .mockResolvedValueOnce(qrResult())
      .mockResolvedValueOnce(
        qrResult({
          relationship: "connected",
          canConnect: false,
          connection: {
            processed: true,
            delivered: true,
            autoAccepted: true,
          },
        })
      )
  })

  it("uses the connect response when choosing friend-added feedback", async () => {
    const user = userEvent.setup()
    render(<QrContactPage />)

    await user.click(await screen.findByRole("button", { name: "connect" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("friend added")
    )
  })

  it("shows lowercase error copy and feedback when connect fails", async () => {
    const user = userEvent.setup()
    mocks.resolveQrContactToken
      .mockReset()
      .mockResolvedValueOnce(qrResult())
      .mockRejectedValueOnce(new Error("network went quiet"))

    render(<QrContactPage />)

    await user.click(await screen.findByRole("button", { name: "connect" }))

    expect(
      await screen.findByText("could not connect. try scanning again.")
    ).toBeInTheDocument()
    expect(mocks.showActionFeedback).toHaveBeenCalledWith(
      "couldn't add friend",
      { tone: "error" }
    )
  })

  it("shows a signed-out visitor who wants to connect, with sign in and create account", async () => {
    mocks.status = "unauthenticated"
    mocks.fetchContactPreviewName.mockResolvedValue("Lena")
    render(<QrContactPage />)

    expect(
      await screen.findByRole("heading", {
        name: "Lena wants to connect on sponti",
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "sign in" })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Fqr%2Fqr-token"
    )
    expect(
      screen.getByRole("link", { name: "create account" })
    ).toHaveAttribute("href", "/register?redirectTo=%2Fqr%2Fqr-token")
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.resolveQrContactToken).not.toHaveBeenCalled()
  })

  it("keeps both choices, with generic copy, when the preview is not live", async () => {
    mocks.status = "unauthenticated"
    mocks.fetchContactPreviewName.mockResolvedValue(null)
    render(<QrContactPage />)

    expect(
      await screen.findByRole("heading", {
        name: "a friend wants to connect on sponti",
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "sign in" })).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "create account" })
    ).toBeInTheDocument()
  })

  it("offers a friend request when the code expired during sign-up", async () => {
    const user = userEvent.setup()
    mocks.resolveQrContactToken
      .mockReset()
      .mockResolvedValueOnce(qrResult({ expired: true }))
      .mockResolvedValueOnce(
        qrResult({
          expired: true,
          relationship: "pending_outgoing",
          canConnect: false,
          connection: {
            processed: true,
            delivered: true,
            autoAccepted: false,
          },
        })
      )

    render(<QrContactPage />)

    expect(
      await screen.findByText(
        "this code expired, but you can still send Nil a friend request."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "connect" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "send request" }))

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("request sent")
    )
    expect(
      await screen.findByText("your request to Nil is pending.")
    ).toBeInTheDocument()
  })

  it("still says the code expired when it is past the grace window", async () => {
    mocks.resolveQrContactToken
      .mockReset()
      .mockRejectedValueOnce(
        new HttpError(
          410,
          "QR contact token expired",
          "QR_CONTACT_TOKEN_EXPIRED"
        )
      )

    render(<QrContactPage />)

    expect(
      await screen.findByText("this qr expired. ask them to show a new code.")
    ).toBeInTheDocument()
  })

  it("offers to connect even when the viewer's own request is pending", async () => {
    mocks.resolveQrContactToken
      .mockReset()
      .mockResolvedValueOnce(qrResult({ relationship: "pending_outgoing" }))

    render(<QrContactPage />)

    expect(
      await screen.findByText(
        "your request to Nil is pending. connect now instead."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "connect" })).toBeEnabled()
  })
})
