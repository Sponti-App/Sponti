import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FlareInviteScreen } from "./flare-invite-screen"
import type {
  FlareInvitePreview,
  FlareInviteStatus,
} from "@/lib/api/flare-invites"
import { HttpError } from "@/lib/http"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  fetchFlareInvitePreview: vi.fn(),
  fetchFlareInviteStatus: vi.fn(),
  redeemFlareInvite: vi.fn(),
  showActionFeedback: vi.fn(),
  status: "authenticated" as "authenticated" | "unauthenticated" | "loading",
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({ showActionFeedback: mocks.showActionFeedback }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ status: mocks.status }),
}))

// The slides have their own tests; here they would only cover the screen.
vi.mock("@/components/intro-slides-gate", () => ({
  IntroSlidesGate: () => null,
}))

vi.mock("@/lib/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/http")>()),
  warmBackends: vi.fn(),
}))

vi.mock("@/lib/api/flare-invites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/flare-invites")>()),
  fetchFlareInvitePreview: mocks.fetchFlareInvitePreview,
  fetchFlareInviteStatus: mocks.fetchFlareInviteStatus,
  redeemFlareInvite: mocks.redeemFlareInvite,
}))

const preview: FlareInvitePreview = {
  host: { displayName: "Patrick Caire", avatarUrl: null },
  title: "drinks at klunkerkranich",
  type: "drinks",
  startAt: new Date(Date.now() + 3_600_000).toISOString(),
  endAt: new Date(Date.now() + 7_200_000).toISOString(),
  placeName: "klunkerkranich",
}

const status = (
  state: FlareInviteStatus["state"],
  eventId: string | null = null
): FlareInviteStatus => ({ state, eventId, preview })

describe("FlareInviteScreen signed out (#616)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = "unauthenticated"
  })

  it("shows who invited them and the flare, and sends 'i'm in' to sign-up and back", async () => {
    mocks.fetchFlareInvitePreview.mockResolvedValue(preview)

    render(<FlareInviteScreen token="tok" />)

    expect(await screen.findByText("patrick invited you")).toBeInTheDocument()
    expect(screen.getByText("drinks at klunkerkranich")).toBeInTheDocument()
    expect(
      screen.getByText(/^drinks · .+ · klunkerkranich$/)
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "i'm in" })).toHaveAttribute(
      "href",
      "/register?redirectTo=%2Ff%2Ftok%3Fin%3D1"
    )
    expect(
      screen.getByRole("link", { name: "i already have an account" })
    ).toHaveAttribute("href", "/login?redirectTo=%2Ff%2Ftok%3Fin%3D1")
    // Nothing that needs an account is asked for.
    expect(mocks.fetchFlareInviteStatus).not.toHaveBeenCalled()
    expect(mocks.redeemFlareInvite).not.toHaveBeenCalled()
  })

  it("says so when the link no longer works, and offers no way in", async () => {
    mocks.fetchFlareInvitePreview.mockResolvedValue(null)

    render(<FlareInviteScreen token="tok" />)

    expect(await screen.findByText("link unavailable")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "i'm in" })).toBeNull()
  })
})

describe("FlareInviteScreen signed in (#616)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = "authenticated"
  })

  it("asks first: nothing is joined until they say 'i'm in'", async () => {
    mocks.fetchFlareInviteStatus.mockResolvedValue(status("none"))

    render(<FlareInviteScreen token="tok" />)

    expect(
      await screen.findByRole("button", { name: "i'm in" })
    ).toBeInTheDocument()
    expect(mocks.redeemFlareInvite).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("takes them to the flare once 'i'm in' puts them on it", async () => {
    const user = userEvent.setup()
    mocks.fetchFlareInviteStatus.mockResolvedValue(status("none"))
    mocks.redeemFlareInvite.mockResolvedValue(status("going", "event-1"))

    render(<FlareInviteScreen token="tok" />)
    await user.click(await screen.findByRole("button", { name: "i'm in" }))

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/event/event-1")
    )
  })

  it("waits on the host for an invite-only flare, naming only what a stranger may see", async () => {
    const user = userEvent.setup()
    mocks.fetchFlareInviteStatus.mockResolvedValue(status("none"))
    mocks.redeemFlareInvite.mockResolvedValue(status("waiting"))

    render(<FlareInviteScreen token="tok" />)
    await user.click(await screen.findByRole("button", { name: "i'm in" }))

    expect(
      await screen.findByText("waiting for patrick to accept")
    ).toBeInTheDocument()
    expect(screen.getByText(/patrick got your friend request/)).toBeVisible()
    expect(screen.getByText("drinks at klunkerkranich")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "i'm in" })).toBeNull()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("redeems on arrival after sign-up, once", async () => {
    mocks.redeemFlareInvite.mockResolvedValue(status("invited", "event-2"))

    render(<FlareInviteScreen token="tok" redeemOnOpen />)

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/event/event-2")
    )
    expect(mocks.redeemFlareInvite).toHaveBeenCalledTimes(1)
    expect(mocks.fetchFlareInviteStatus).not.toHaveBeenCalled()
  })

  it("goes straight to a flare they are already on", async () => {
    mocks.fetchFlareInviteStatus.mockResolvedValue(status("going", "event-3"))

    render(<FlareInviteScreen token="tok" />)

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/event/event-3")
    )
  })

  it("explains a link that no longer works", async () => {
    mocks.fetchFlareInviteStatus.mockRejectedValue(
      new HttpError(404, "gone", "FLARE_INVITE_NOT_FOUND")
    )

    render(<FlareInviteScreen token="tok" />)

    expect(await screen.findByText("link unavailable")).toBeInTheDocument()
    expect(
      screen.getByText(/the flare may be over, or the host made a new link/)
    ).toBeInTheDocument()
  })

  it("says a full flare is full, and lets them see it", async () => {
    const user = userEvent.setup()
    mocks.fetchFlareInviteStatus.mockResolvedValue(status("none"))
    mocks.redeemFlareInvite.mockRejectedValue(
      new HttpError(409, "full", "EVENT_FULL")
    )

    render(<FlareInviteScreen token="tok" />)
    await user.click(await screen.findByRole("button", { name: "i'm in" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "this flare is full."
    )
    expect(screen.getByText("drinks at klunkerkranich")).toBeInTheDocument()
  })
})
