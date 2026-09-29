import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

// #93/#159: re-share ("can re-share" / allowForward) is hidden behind the
// tester feature profile until its privacy questions are answered; +1
// ("+1 allowed" / allowPlusOne) ships regardless and must stay visible in
// both profiles. new-event-drawer.tsx reads featureFlags.reshare, which
// reads NEXT_PUBLIC_FEATURE_PROFILE at module load, so each case needs a
// fresh module graph (matches the pattern in auth-provider.test.tsx).

const mocks = vi.hoisted(() => ({
  showActionFeedback: vi.fn(),
  useAuth: vi.fn(),
  fetchMyCircles: vi.fn(),
  fetchAcceptedConnections: vi.fn(),
  useGeolocation: vi.fn(),
  emitEventsChanged: vi.fn(),
}))

vi.mock("@/components/action-feedback", () => ({
  useActionFeedback: () => ({
    showActionFeedback: mocks.showActionFeedback,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () =>
    mocks.useAuth() ?? {
      user: { id: "u1", displayName: "Test" },
      status: "authenticated",
    },
}))

vi.mock("@/lib/api/circles", () => ({
  fetchMyCircles: () => mocks.fetchMyCircles() ?? Promise.resolve([]),
  addCircleMember: vi.fn().mockResolvedValue(undefined),
  removeCircleMember: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/api/connections", () => ({
  fetchAcceptedConnections: () =>
    mocks.fetchAcceptedConnections() ?? Promise.resolve([]),
}))

vi.mock("@/lib/geolocation", () => ({
  useGeolocation: () =>
    mocks.useGeolocation() ?? {
      coords: null,
      status: "idle",
      errorMessage: null,
      request: vi.fn(),
    },
}))

vi.mock("@/lib/use-events", () => ({
  emitEventsChanged: mocks.emitEventsChanged,
}))

vi.mock("@/lib/haptics", () => ({
  haptic: vi.fn(),
}))

async function loadDrawer() {
  vi.resetModules()
  const { NewEventDrawer } = await import("./new-event-drawer")
  return NewEventDrawer
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

// A friend + a non-empty "all friends" circle, so the composer defaults to
// private (zero friends defaults to public) and the invite toggles render.
function stubOneFriend() {
  mocks.fetchAcceptedConnections.mockResolvedValue([
    { id: "f1", displayName: "Friend", username: "friend" },
  ])
  mocks.fetchMyCircles.mockResolvedValue([
    {
      id: "all",
      name: "all friends",
      description: "",
      type: "all" as const,
      memberIds: ["f1"],
    },
  ])
}

async function openWhoSection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: /all friends · 1/i })
  )
}

describe("NewEventDrawer re-share toggle (#93, #159)", () => {
  it("hides the re-share toggle in the tester profile (default)", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", undefined)
    stubOneFriend()
    const NewEventDrawer = await loadDrawer()
    const user = userEvent.setup()

    render(<NewEventDrawer open onClose={vi.fn()} />)
    await openWhoSection(user)

    expect(
      await screen.findByRole("button", { name: /\+1 allowed/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /can re-share/i })
    ).not.toBeInTheDocument()
  })

  it("shows the re-share toggle in the full profile", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_PROFILE", "full")
    stubOneFriend()
    const NewEventDrawer = await loadDrawer()
    const user = userEvent.setup()

    render(<NewEventDrawer open onClose={vi.fn()} />)
    await openWhoSection(user)

    expect(
      await screen.findByRole("button", { name: /\+1 allowed/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /can re-share/i })
    ).toBeInTheDocument()
  })
})
