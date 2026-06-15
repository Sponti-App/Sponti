import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import QrContactPage from "./page"
import type { QrContactResolveResult } from "@/lib/api/qr-contact-tokens"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  resolveQrContactToken: vi.fn(),
  showActionFeedback: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "qr-token" }),
  useRouter: () => ({ back: mocks.back, push: mocks.push }),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ status: "authenticated" }),
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

    await user.click(await screen.findByRole("button", { name: "add friend" }))

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

    await user.click(await screen.findByRole("button", { name: "add friend" }))

    expect(
      await screen.findByText(
        "could not send the friend request. try scanning again."
      )
    ).toBeInTheDocument()
    expect(mocks.showActionFeedback).toHaveBeenCalledWith(
      "couldn't add friend",
      { tone: "error" }
    )
  })
})
