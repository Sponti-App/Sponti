import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getIdeasNear } from "@/lib/flare-ideas"
import {
  markOnboardingPending,
  resetOnboardingMemory,
  shouldShowOnboarding,
} from "@/lib/onboarding"
import { setIdeasHidden } from "@/lib/idea-preferences"
import {
  firstFlarePrefill,
  FirstRunIntro,
  pickFirstRunCta,
} from "./first-run-intro"

const mocks = vi.hoisted(() => ({
  openDrawer: vi.fn(),
  fetchAcceptedConnections: vi.fn(),
  readLastKnownCoords: vi.fn(),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { displayName: "Sam", username: "sam" },
  }),
}))

vi.mock("@/components/new-event-drawer-provider", () => ({
  useNewEventDrawer: () => ({ openDrawer: mocks.openDrawer }),
}))

vi.mock("@/components/qr-share-sheet", () => ({
  QrShareSheet: ({ onClose }: { onClose: () => void }) => (
    <div role="region" aria-label="qr sheet">
      <button type="button" onClick={onClose}>
        close qr
      </button>
    </div>
  ),
}))

vi.mock("@/lib/api/connections", () => ({
  fetchAcceptedConnections: mocks.fetchAcceptedConnections,
}))

vi.mock("@/lib/geolocation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/geolocation")>()),
  readLastKnownCoords: mocks.readLastKnownCoords,
}))

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

// Humboldthain, berlin, on a day its idea spots are in season (#243).
const BERLIN = { lat: 52.5474, lng: 13.3873 }
const JUNE = new Date("2026-06-15T12:00:00.000Z")
const FRIEND = { id: "f1", connectionId: "c1", displayName: "A", username: "a" }

beforeEach(() => {
  window.localStorage.clear()
  resetOnboardingMemory()
  setIdeasHidden(false)
  mocks.fetchAcceptedConnections.mockResolvedValue([])
  mocks.readLastKnownCoords.mockReturnValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

async function walkToLast(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "next" }))
  await user.click(screen.getByRole("button", { name: "next" }))
  expect(
    screen.getByRole("heading", { name: "choose who sees it" })
  ).toBeInTheDocument()
}

describe("pickFirstRunCta (#313)", () => {
  it("asks for a first friend with no connections", () => {
    expect(pickFirstRunCta(0)).toBe("add-friend")
  })

  it("asks for a first flare with one or more", () => {
    expect(pickFirstRunCta(1)).toBe("light-flare")
    expect(pickFirstRunCta(12)).toBe("light-flare")
  })
})

describe("firstFlarePrefill (#313)", () => {
  it("prefills the nearest idea", () => {
    const [nearest] = getIdeasNear({ center: BERLIN, now: JUNE, limit: 1 })
    expect(nearest).toBeDefined()

    expect(firstFlarePrefill(BERLIN, JUNE, false)).toMatchObject({
      title: nearest.title,
      category: nearest.category,
      place: { name: nearest.place.name },
    })
  })

  it("is empty with no position, no idea nearby, or ideas switched off", () => {
    expect(firstFlarePrefill(null, JUNE, false)).toBeUndefined()
    expect(
      firstFlarePrefill({ lat: 37.7749, lng: -122.4194 }, JUNE, false)
    ).toBeUndefined()
    expect(firstFlarePrefill(BERLIN, JUNE, true)).toBeUndefined()
  })
})

describe("FirstRunIntro (#313)", () => {
  it("renders nothing unless a new account is waiting for it", () => {
    render(<FirstRunIntro />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("walks three screens and asks for a first friend with no connections", async () => {
    markOnboardingPending()
    const user = userEvent.setup()
    render(<FirstRunIntro />)

    expect(
      screen.getByRole("heading", { name: "see flares near you" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "next" }))
    expect(
      screen.getByRole("heading", { name: "light a flare fast" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "next" }))

    const cta = await screen.findByRole("button", {
      name: "add your first friend",
    })
    await user.click(cta)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "qr sheet" })).toBeInTheDocument()
    expect(mocks.openDrawer).not.toHaveBeenCalled()
    expect(shouldShowOnboarding()).toBe(false)

    await user.click(screen.getByRole("button", { name: "close qr" }))
    expect(
      screen.queryByRole("region", { name: "qr sheet" })
    ).not.toBeInTheDocument()
  })

  it("asks for a first flare when already connected, prefilled with a nearby idea", async () => {
    markOnboardingPending()
    mocks.fetchAcceptedConnections.mockResolvedValue([FRIEND])
    mocks.readLastKnownCoords.mockReturnValue(BERLIN)
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(JUNE)
    const user = userEvent.setup()
    render(<FirstRunIntro />)

    await walkToLast(user)
    await user.click(
      await screen.findByRole("button", { name: "light your first flare" })
    )
    vi.useRealTimers()

    expect(mocks.openDrawer).toHaveBeenCalledWith(
      firstFlarePrefill(BERLIN, JUNE, false)
    )
    expect(mocks.openDrawer.mock.calls[0][0]).toBeDefined()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(shouldShowOnboarding()).toBe(false)
  })

  it("opens an empty composer when no idea is nearby", async () => {
    markOnboardingPending()
    mocks.fetchAcceptedConnections.mockResolvedValue([FRIEND])
    const user = userEvent.setup()
    render(<FirstRunIntro />)

    await walkToLast(user)
    await user.click(
      await screen.findByRole("button", { name: "light your first flare" })
    )

    expect(mocks.openDrawer).toHaveBeenCalledWith(undefined)
  })

  it("treats a failed connections load as no friends yet", async () => {
    markOnboardingPending()
    mocks.fetchAcceptedConnections.mockRejectedValue(new Error("offline"))
    const user = userEvent.setup()
    render(<FirstRunIntro />)

    await walkToLast(user)

    expect(
      await screen.findByRole("button", { name: "add your first friend" })
    ).toBeEnabled()
  })

  it("holds the last button until the connection count is known", async () => {
    markOnboardingPending()
    let resolve: (value: unknown[]) => void = () => {}
    mocks.fetchAcceptedConnections.mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const user = userEvent.setup()
    render(<FirstRunIntro />)

    await walkToLast(user)
    expect(screen.getByRole("button", { name: "one moment…" })).toBeDisabled()

    await act(async () => resolve([FRIEND]))
    expect(
      screen.getByRole("button", { name: "light your first flare" })
    ).toBeEnabled()
  })

  for (const screenIndex of [0, 1, 2]) {
    it(`skip works from screen ${screenIndex + 1}`, async () => {
      markOnboardingPending()
      const user = userEvent.setup()
      render(<FirstRunIntro />)
      for (let i = 0; i < screenIndex; i++) {
        await user.click(screen.getByRole("button", { name: "next" }))
      }

      await user.click(screen.getByRole("button", { name: "skip" }))

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      )
      expect(shouldShowOnboarding()).toBe(false)
      expect(mocks.openDrawer).not.toHaveBeenCalled()
    })
  }
})
