import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import InviteLinkPage from "./page"
import type { InviteLinkResolveResult } from "@/lib/api/invite-links"
import { HttpError } from "@/lib/http"

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  resolveInviteLink: vi.fn(),
  fetchContactPreviewName: vi.fn(),
  showActionFeedback: vi.fn(),
  status: "authenticated" as "authenticated" | "unauthenticated",
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "invite-token" }),
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

vi.mock("@/lib/api/invite-links", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/invite-links")>()
  return {
    ...actual,
    resolveInviteLink: mocks.resolveInviteLink,
  }
})

function inviteResult(
  overrides: Partial<InviteLinkResolveResult> = {}
): InviteLinkResolveResult {
  return {
    profile: { id: "user-2", username: "nil", displayName: "Nil" },
    relationship: "none",
    canConnect: true,
    expiresAt: "2099-05-21T12:00:00.000Z",
    connection: null,
    ...overrides,
  }
}

describe("InviteLinkPage (#124)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = "authenticated"
  })

  it("sends a friend request (not an instant connection)", async () => {
    const user = userEvent.setup()
    mocks.resolveInviteLink
      .mockResolvedValueOnce(inviteResult())
      .mockResolvedValueOnce(
        inviteResult({ relationship: "pending_outgoing", canConnect: false })
      )

    render(<InviteLinkPage />)
    expect(
      await screen.findByText("send Nil a friend request.")
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "send request" }))

    expect(mocks.resolveInviteLink).toHaveBeenLastCalledWith(
      "invite-token",
      true
    )
    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("request sent")
    )
    expect(
      await screen.findByText("your request to Nil is pending.")
    ).toBeInTheDocument()
  })

  it("explains an expired link", async () => {
    mocks.resolveInviteLink.mockRejectedValueOnce(
      new HttpError(410, "Invite link expired", "INVITE_LINK_EXPIRED")
    )

    render(<InviteLinkPage />)

    expect(
      await screen.findByText(
        "this invite link expired. ask them for a new one."
      )
    ).toBeInTheDocument()
  })

  it("treats a revoked link as unavailable", async () => {
    mocks.resolveInviteLink.mockRejectedValueOnce(
      new HttpError(404, "Invite link not found", "INVITE_LINK_NOT_FOUND")
    )

    render(<InviteLinkPage />)

    expect(
      await screen.findByText("this invite link is no longer available.")
    ).toBeInTheDocument()
  })

  it("shows a signed-out visitor who wants to connect, with sign in and create account", async () => {
    mocks.status = "unauthenticated"
    mocks.fetchContactPreviewName.mockResolvedValue("Lena")
    render(<InviteLinkPage />)

    expect(
      await screen.findByRole("heading", {
        name: "Lena wants to connect on sponti",
      })
    ).toBeInTheDocument()
    expect(mocks.fetchContactPreviewName).toHaveBeenCalledWith(
      "invite",
      "invite-token",
      expect.any(AbortSignal)
    )
    expect(screen.getByRole("link", { name: "sign in" })).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Finvite%2Finvite-token"
    )
    expect(
      screen.getByRole("link", { name: "create account" })
    ).toHaveAttribute("href", "/register?redirectTo=%2Finvite%2Finvite-token")
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.resolveInviteLink).not.toHaveBeenCalled()
  })
})
