import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FlareInviteButton } from "./flare-invite-button"

const mocks = vi.hoisted(() => ({
  fetchEventInviteLink: vi.fn(),
  showActionFeedback: vi.fn(),
  share: vi.fn(),
  writeText: vi.fn(),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: mocks.showActionFeedback }),
}))

vi.mock("@/lib/api/flare-invites", () => ({
  fetchEventInviteLink: mocks.fetchEventInviteLink,
}))

const event = {
  id: "event-1",
  title: "drinks at klunkerkranich",
  type: "drinks" as const,
  startAt: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString(),
  endAt: new Date(Date.now() + 3 * 24 * 3_600_000 + 3_600_000).toISOString(),
}

function setShare(value: typeof mocks.share | undefined) {
  Object.defineProperty(navigator, "share", { configurable: true, value })
}

function setClipboard(
  value: { writeText: typeof mocks.writeText } | undefined
) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value })
}

const button = () => screen.getByRole("button", { name: /invite/ })

describe("FlareInviteButton (#616)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.sponti.fun")
    mocks.fetchEventInviteLink.mockResolvedValue("tok_123")
    mocks.share.mockResolvedValue(undefined)
    mocks.writeText.mockResolvedValue(undefined)
    setShare(mocks.share)
    setClipboard({ writeText: mocks.writeText })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    setShare(undefined)
    setClipboard(undefined)
  })

  it("is ready before it is tapped: the link is fetched on mount, not on tap", async () => {
    render(<FlareInviteButton event={event} hostName="Patrick Caire" />)

    expect(button()).toBeDisabled()
    await waitFor(() => expect(button()).toBeEnabled())
    expect(mocks.fetchEventInviteLink).toHaveBeenCalledTimes(1)
  })

  it("opens the share sheet with the invite message and the link", async () => {
    const user = userEvent.setup()
    render(<FlareInviteButton event={event} hostName="Patrick Caire" />)
    await waitFor(() => expect(button()).toBeEnabled())

    await user.click(button())

    expect(mocks.share).toHaveBeenCalledTimes(1)
    const [data] = mocks.share.mock.calls[0]
    expect(data.url).toBe("https://app.sponti.fun/f/tok_123")
    expect(data.text).toMatch(
      /^Patrick invited you to drinks at klunkerkranich on \w+day, /
    )
    expect(mocks.writeText).not.toHaveBeenCalled()
    expect(mocks.showActionFeedback).not.toHaveBeenCalled()
  })

  it("copies the link and says so when there is no share sheet", async () => {
    setShare(undefined)
    const user = userEvent.setup()
    // user-event installs its own clipboard; put ours back in front of it.
    setClipboard({ writeText: mocks.writeText })
    render(<FlareInviteButton event={event} hostName="Patrick" />)
    await waitFor(() => expect(button()).toBeEnabled())

    await user.click(button())

    expect(mocks.writeText).toHaveBeenCalledWith(
      "https://app.sponti.fun/f/tok_123"
    )
    expect(mocks.showActionFeedback).toHaveBeenCalledWith("link copied")
  })

  it("stays quiet when they close the share sheet", async () => {
    mocks.share.mockRejectedValue(
      Object.assign(new Error("closed"), { name: "AbortError" })
    )
    const user = userEvent.setup()
    render(<FlareInviteButton event={event} hostName="Patrick" />)
    await waitFor(() => expect(button()).toBeEnabled())

    await user.click(button())

    expect(mocks.showActionFeedback).not.toHaveBeenCalled()
  })

  it("lets them try again if the link could not be fetched", async () => {
    mocks.fetchEventInviteLink
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce("tok_2")
    const user = userEvent.setup()
    render(<FlareInviteButton event={event} hostName="Patrick" />)
    await waitFor(() => expect(mocks.fetchEventInviteLink).toHaveBeenCalled())
    await waitFor(() => expect(button()).toBeEnabled())

    await user.click(button())
    await waitFor(() =>
      expect(mocks.fetchEventInviteLink).toHaveBeenCalledTimes(2)
    )
    await waitFor(() => expect(button()).toBeEnabled())
    await user.click(button())

    expect(mocks.share).toHaveBeenCalledTimes(1)
    expect(mocks.share.mock.calls[0][0].url).toBe(
      "https://app.sponti.fun/f/tok_2"
    )
  })
})
