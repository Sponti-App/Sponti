import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import QrContactPage from "./page"
import type { QrContactResolveResult } from "@/lib/api/qr-contact-tokens"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  resolveQrContactToken: vi.fn(),
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

  it("sends a signed-out visitor straight to sign-up, returning here", async () => {
    mocks.status = "unauthenticated"
    render(<QrContactPage />)

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        "/register?redirectTo=%2Fqr%2Fqr-token"
      )
    )
    expect(mocks.resolveQrContactToken).not.toHaveBeenCalled()
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
