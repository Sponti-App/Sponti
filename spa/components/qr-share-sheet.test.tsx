import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QrShareSheet } from "./qr-share-sheet"

const mocks = vi.hoisted(() => ({
  createQrContactToken: vi.fn(),
  getMyInviteLink: vi.fn(),
  resetMyInviteLink: vi.fn(),
  showActionFeedback: vi.fn(),
  share: vi.fn(),
  toDataURL: vi.fn(),
  writeText: vi.fn(),
}))

vi.mock("qrcode", () => ({
  default: {
    toDataURL: mocks.toDataURL,
  },
}))

vi.mock("@/lib/api/qr-contact-tokens", () => ({
  createQrContactToken: mocks.createQrContactToken,
}))

vi.mock("@/lib/api/invite-links", () => ({
  getMyInviteLink: mocks.getMyInviteLink,
  resetMyInviteLink: mocks.resetMyInviteLink,
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

function setNativeShare(value: typeof mocks.share | undefined): void {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value,
  })
}

function setClipboardWriteText(): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.writeText },
  })
}

async function clickShare(): Promise<void> {
  const user = userEvent.setup()
  render(
    <QrShareSheet displayName="Martin" handle="martin" onClose={vi.fn()} />
  )

  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /share sponti link/i })
    ).toBeEnabled()
  )
  await user.click(screen.getByRole("button", { name: /share sponti link/i }))
}

describe("QrShareSheet action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.toDataURL.mockResolvedValue("data:image/png;base64,qr")
    mocks.createQrContactToken.mockResolvedValue({
      token: "qr-token",
      expiresAt: "2099-01-01T00:15:00.000Z",
      expiresInSeconds: 900,
    })
    mocks.getMyInviteLink.mockResolvedValue({
      token: "invite-token",
      expiresAt: "2099-01-08T00:00:00.000Z",
      expiresInSeconds: 604800,
    })
    mocks.share.mockResolvedValue(undefined)
    mocks.writeText.mockResolvedValue(undefined)
    setClipboardWriteText()
  })

  it("confirms when native share succeeds", async () => {
    setNativeShare(mocks.share)

    await clickShare()

    await waitFor(() => expect(mocks.share).toHaveBeenCalled())
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("link shared")
  })

  it("does not show an error when native share is cancelled", async () => {
    setNativeShare(mocks.share)
    mocks.share.mockRejectedValue(new DOMException("cancelled", "AbortError"))

    await clickShare()

    await waitFor(() => expect(mocks.share).toHaveBeenCalled())
    expect(mocks.showActionFeedback).not.toHaveBeenCalled()
  })

  it("surfaces feedback when native share fails", async () => {
    setNativeShare(mocks.share)
    mocks.share.mockRejectedValue(new Error("share failed"))

    await clickShare()

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't share link",
        { tone: "error" }
      )
    )
  })

  it("surfaces feedback when native share has no targets", async () => {
    setNativeShare(mocks.share)
    mocks.share.mockRejectedValue(
      new DOMException("no share targets available", "AbortError")
    )

    await clickShare()

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "couldn't share link",
        { tone: "error" }
      )
    )
  })

  it("confirms when the fallback link copy succeeds", async () => {
    setNativeShare(undefined)

    await clickShare()

    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith("link copied")
    )
  })

  it("shares the 7-day invite link, not the QR token", async () => {
    setNativeShare(mocks.share)

    await clickShare()

    await waitFor(() => expect(mocks.share).toHaveBeenCalled())
    const shared = mocks.share.mock.calls[0]?.[0] as { url: string }
    expect(shared.url).toBe(`${window.location.origin}/invite/invite-token`)
    expect(mocks.toDataURL).toHaveBeenCalledWith(
      `${window.location.origin}/qr/qr-token`,
      expect.anything()
    )
  })

  it("reset link revokes the old link and shares the new one", async () => {
    setNativeShare(mocks.share)
    mocks.resetMyInviteLink.mockResolvedValue({
      token: "fresh-token",
      expiresAt: "2099-01-08T00:00:00.000Z",
      expiresInSeconds: 604800,
    })
    const user = userEvent.setup()
    render(
      <QrShareSheet displayName="Martin" handle="martin" onClose={vi.fn()} />
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /share sponti link/i })
      ).toBeEnabled()
    )
    await user.click(screen.getByRole("button", { name: /reset link/i }))
    await waitFor(() =>
      expect(mocks.showActionFeedback).toHaveBeenCalledWith(
        "new link ready. the old one no longer works."
      )
    )
    await user.click(screen.getByRole("button", { name: /share sponti link/i }))

    await waitFor(() => expect(mocks.share).toHaveBeenCalled())
    const shared = mocks.share.mock.calls[0]?.[0] as { url: string }
    expect(shared.url).toBe(`${window.location.origin}/invite/fresh-token`)
  })
})
