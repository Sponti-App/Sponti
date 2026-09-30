import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

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

import { NewEventDrawer } from "./new-event-drawer"
import {
  NewEventDrawerProvider,
  useNewEventDrawer,
} from "./new-event-drawer-provider"

describe("NewEventDrawer render", () => {
  // #134: the composer stays mounted, so it used to load friends once at
  // sign-in. A friend accepted later never appeared until a full reload.
  it("refreshes friends and circles every time it opens", async () => {
    const friend = { id: "f1", displayName: "Friend", username: "friend" }
    const circle = (memberIds: string[]) => ({
      id: "all",
      name: "all friends",
      description: "",
      type: "all" as const,
      memberIds,
    })
    mocks.fetchAcceptedConnections
      .mockResolvedValueOnce([])
      .mockResolvedValue([friend])
    mocks.fetchMyCircles
      .mockResolvedValueOnce([circle([])])
      .mockResolvedValue([circle(["f1"])])

    const { rerender } = render(
      <NewEventDrawer open={false} onClose={vi.fn()} />
    )
    await waitFor(() =>
      expect(mocks.fetchAcceptedConnections).toHaveBeenCalledTimes(1)
    )

    rerender(<NewEventDrawer open onClose={vi.fn()} />)

    await waitFor(() =>
      expect(mocks.fetchAcceptedConnections).toHaveBeenCalledTimes(2)
    )
    // With no friends the draft defaulted to public; the refresh moves an
    // untouched draft back to all friends, now including the new friend.
    expect(await screen.findByText(/all friends · 1/i)).toBeInTheDocument()
  })

  it("renders title and CTA when open", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    expect(screen.getAllByText("light a flare").length).toBeGreaterThanOrEqual(
      1
    )
    expect(screen.getByPlaceholderText(/what's the plan/i)).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-vaul-snap-points",
      "true"
    )
  })

  it("renders mode toggle tabs", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    expect(screen.getByText("right now")).toBeInTheDocument()
    expect(screen.getByText("pick a time")).toBeInTheDocument()
  })

  it("does not autoFocus the title input", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText(/what's the plan/i)
    expect(input).not.toHaveFocus()
  })

  // vaul slides the sheet down by (viewport − snap); without an explicit
  // viewport-filling height the sheet lands entirely below the viewport.
  // Geometry itself needs a real browser — this locks in the height contract.
  //
  // The height must also stay keyboard-independent, so vaul's transform keeps
  // landing where it intends. Only `bottom` moves (see below).
  it("anchors the sheet at full viewport height", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.className).toContain("h-full")
    expect(dialog.style.height).toBe("")
  })

  // Regression guard for issue #94: vaul's keyboard repositioning computes a
  // sliver height from the sheet's transformed rect and then pushes it below
  // the fold, which made the sheet vanish outright. We opt out and lift the
  // sheet ourselves, so this node must carry our inset rather than a bare
  // bottom-0 that vaul would have overwritten.
  it("lifts the sheet by the keyboard inset rather than vaul's offset", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.className).not.toContain("bottom-0")
    expect(dialog.style.bottom).toContain("--sponti-kb-inset")
  })

  // The sheet must stay modal. The background has to be inert while composing,
  // and the page-scroll lock that stops Safari sliding the page out from under
  // the fixed sheet comes from Radix's RemoveScroll under Dialog.Content, which
  // only applies on the modal path.
  //
  // NB: the matching "…and is released on close" assertion is not testable
  // here. Radix keeps the layer mounted until the exit animation ends, and
  // jsdom mis-resolves vaul's attribute-selector CSS — it reports the
  // `[data-vaul-snap-points=false]` close animation that never applies to a
  // snap-point drawer in a real browser — so Presence never completes.
  // Verified on device instead; see the PR checklist.
  it("makes the background inert while open", () => {
    render(<NewEventDrawer open onClose={vi.fn()} />)
    expect(document.body.style.pointerEvents).toBe("none")
  })

  // The sheet used to only ever grow: expanding "how long?" raised it to mid
  // and collapsing it again left a tall sheet with a dead gap under the
  // controls. Tapping a chip should size the sheet to what that state needs.
  // Probed via data-snap rather than the rendered height: the card's height is
  // measured onto the on-screen slot at frame rate (useSheetVisibleHeight), so
  // the inline style is only a first-paint fallback and not the live value.
  it("returns to peek when an expanded section is collapsed", async () => {
    const user = userEvent.setup()
    render(<NewEventDrawer open onClose={vi.fn()} />)
    const card = screen.getByRole("dialog").firstElementChild as HTMLElement

    expect(card.dataset.snap).toBe("380px")

    const whenChip = screen.getByRole("button", { name: /now · 1h/i })
    await user.click(whenChip)
    expect(card.dataset.snap).toBe("0.7")

    await user.click(whenChip)
    expect(card.dataset.snap).toBe("380px")
  })
})

// #160: a failing places proxy (for example a missing server key) used to look
// like "no matches". It must say the search is unavailable.
describe("NewEventDrawer place search", () => {
  it("says place search is unavailable when the proxy fails", async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 500 }))

    render(<NewEventDrawer open onClose={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /my location/i }))
    await user.click(
      screen.getByRole("button", { name: /search for a place/i })
    )
    await user.type(screen.getByPlaceholderText("search for a place"), "coffee")

    expect(
      await screen.findByText(/place search isn't available/i)
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalled()
    fetchMock.mockRestore()
  })
})

// #172: custom circles created on the Circles page never showed up as an
// audience option in the composer — CircleCards only rendered the three
// system circles (inner/close/all) and silently dropped anything typed
// "custom", even though the API already returns and accepts them.
describe("NewEventDrawer custom circle audience", () => {
  it("lists a custom circle alongside the system circles and selects it as the audience", async () => {
    const user = userEvent.setup()
    mocks.fetchAcceptedConnections.mockResolvedValue([
      { id: "f1", displayName: "Friend", username: "friend" },
      { id: "f2", displayName: "Other", username: "other" },
    ])
    mocks.fetchMyCircles.mockResolvedValue([
      {
        id: "all",
        name: "all friends",
        description: "",
        type: "all",
        memberIds: ["f1", "f2"],
      },
      {
        id: "c-custom",
        name: "book club",
        description: "custom circle",
        type: "custom",
        memberIds: ["f1"],
      },
    ])

    render(<NewEventDrawer open onClose={vi.fn()} />)

    // Open the "who" section — its trigger chip shows the current audience
    // summary, defaulting to "all friends".
    await user.click(
      await screen.findByRole("button", { name: /all friends · 2/i })
    )

    const customChip = await screen.findByRole("button", {
      name: /book club/i,
    })
    // Member count is shown on the chip, same as the system circles.
    expect(customChip).toHaveTextContent("1")

    await user.click(customChip)

    // Selecting the custom circle swaps it in as the audience, and its
    // member is invited.
    expect(await screen.findByText(/book club · 1/i)).toBeInTheDocument()
  })

  it("shows a custom circle even when no system circle was returned", async () => {
    // At least one accepted connection, so the composer defaults to private
    // (public-only kicks in with zero friends) — the case under test is the
    // circle row itself, not that fallback.
    mocks.fetchAcceptedConnections.mockResolvedValue([
      { id: "f1", displayName: "Friend", username: "friend" },
    ])
    mocks.fetchMyCircles.mockResolvedValue([
      {
        id: "c-custom-only",
        name: "solo custom",
        description: "custom circle",
        type: "custom",
        memberIds: [],
      },
    ])

    const user = userEvent.setup()
    render(<NewEventDrawer open onClose={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /friends/i }))

    expect(
      await screen.findByRole("button", { name: /solo custom/i })
    ).toBeInTheDocument()
    // No system circles were returned, so the "no circles available" empty
    // state must not show up merely because the system row is empty.
    expect(screen.queryByText("no circles available")).not.toBeInTheDocument()
  })
})

// #135: the "no friends yet" prompt is pinned above the CTA and covered the
// field being typed in. It must close on × or on a tap outside it.
describe("NewEventDrawer no-friends audience prompt", () => {
  const PROMPT = /no friends on sponti yet/i
  // A friend exists but the default audience circle is empty, so the draft
  // has nobody to invite and the prompt shows.
  const renderWithEmptyAudience = async () => {
    mocks.fetchAcceptedConnections.mockResolvedValue([
      { id: "f1", displayName: "Friend", username: "friend" },
    ])
    mocks.fetchMyCircles.mockResolvedValue([
      {
        id: "all",
        name: "all friends",
        description: "",
        type: "all",
        memberIds: [],
      },
    ])
    render(<NewEventDrawer open onClose={vi.fn()} />)
    expect(await screen.findByText(PROMPT)).toBeInTheDocument()
  }

  it("closes on its dismiss button", async () => {
    const user = userEvent.setup()
    await renderWithEmptyAudience()
    await user.click(screen.getByRole("button", { name: "dismiss" }))
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
  })

  it("closes when tapping a field outside it", async () => {
    const user = userEvent.setup()
    await renderWithEmptyAudience()
    await user.click(screen.getByPlaceholderText(/what's the plan/i))
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
  })

  it("stays open when tapping inside it", async () => {
    const user = userEvent.setup()
    await renderWithEmptyAudience()
    await user.click(screen.getByText(PROMPT))
    expect(screen.getByText(PROMPT)).toBeInTheDocument()
  })
})

// #241: the composer stays mounted under the provider and initialises its
// state once, so a prefill has to land each time the drawer opens.
describe("NewEventDrawer prefill", () => {
  const humboldthain = {
    source: "place" as const,
    name: "humboldthain",
    address: "brunnenstrasse, berlin",
    placeId: "p1",
    coordinates: [13.38, 52.55] as [number, number],
  }

  it("opens with title, category and place filled in", async () => {
    const { rerender } = render(
      <NewEventDrawer open={false} onClose={vi.fn()} />
    )

    rerender(
      <NewEventDrawer
        open
        onClose={vi.fn()}
        prefill={{
          title: "roses at humboldthain",
          category: "hangout",
          place: humboldthain,
        }}
      />
    )
    expect(
      await screen.findByDisplayValue("roses at humboldthain")
    ).toBeVisible()
    expect(screen.getByText(/type · hang out/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /humboldthain/i })).toBeVisible()
    // A manual pick: it can be reset, and the "auto" tag is not shown.
    expect(screen.queryByText("(auto)")).not.toBeInTheDocument()
  })

  it("keeps an unsent draft of the person's own when a prefill arrives", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<NewEventDrawer open onClose={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/what's the plan/i), "picnic")
    rerender(<NewEventDrawer open={false} onClose={vi.fn()} />)
    rerender(
      <NewEventDrawer open onClose={vi.fn()} prefill={{ category: "drinks" }} />
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByDisplayValue("picnic")).toBeInTheDocument()
    expect(screen.queryByText(/type · drinks/i)).not.toBeInTheDocument()
  })

  it("keeps edits made over a prefill when the next prefill arrives", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <NewEventDrawer open onClose={vi.fn()} prefill={{ title: "roses" }} />
    )
    await user.type(await screen.findByDisplayValue("roses"), " and more")
    rerender(<NewEventDrawer open={false} onClose={vi.fn()} />)
    rerender(
      <NewEventDrawer open onClose={vi.fn()} prefill={{ category: "drinks" }} />
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByDisplayValue("roses and more")).toBeInTheDocument()
  })

  it("replaces a prefill the person never touched with the next one", async () => {
    const { rerender } = render(
      <NewEventDrawer
        open
        onClose={vi.fn()}
        prefill={{ title: "roses", place: humboldthain }}
      />
    )
    expect(await screen.findByDisplayValue("roses")).toBeVisible()
    rerender(<NewEventDrawer open={false} onClose={vi.fn()} />)
    rerender(
      <NewEventDrawer
        open
        onClose={vi.fn()}
        prefill={{ title: "ice cream", category: "food" }}
      />
    )
    expect(await screen.findByDisplayValue("ice cream")).toBeVisible()
    expect(screen.queryByDisplayValue("roses")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /my location/i })).toBeVisible()
  })

  it("does not reapply the prefill over edits when friends and circles load", async () => {
    const user = userEvent.setup()
    let resolveCircles: (circles: never[]) => void = () => undefined
    mocks.fetchMyCircles.mockReturnValueOnce(
      new Promise<never[]>((resolve) => {
        resolveCircles = resolve
      })
    )
    render(
      <NewEventDrawer open onClose={vi.fn()} prefill={{ title: "roses" }} />
    )
    await user.type(await screen.findByDisplayValue("roses"), "!")

    // The late load changes what resetEventDraft closes over; the effect must
    // not read that as a fresh open.
    resolveCircles([])
    await waitFor(() => expect(mocks.fetchMyCircles).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByDisplayValue("roses!")).toBeInTheDocument()
  })

  it("keeps an unsent draft when it opens without a prefill", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<NewEventDrawer open onClose={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/what's the plan/i), "picnic")
    rerender(<NewEventDrawer open={false} onClose={vi.fn()} />)
    rerender(<NewEventDrawer open onClose={vi.fn()} />)
    expect(screen.getByDisplayValue("picnic")).toBeInTheDocument()
  })
})

describe("NewEventDrawerProvider openDrawer", () => {
  function Triggers() {
    const { openDrawer, closeDrawer } = useNewEventDrawer()
    return (
      <>
        <button onClick={() => openDrawer({ title: "roses" })}>with</button>
        {/* Wired straight to onClick, as the nav flare button is (there it
            goes through a `() => void` type, hence the cast). */}
        <button onClick={openDrawer as () => void}>plain</button>
        <button onClick={closeDrawer}>close</button>
      </>
    )
  }

  it("prefills on open, and a bare click handler keeps the unsent draft", async () => {
    const user = userEvent.setup()
    render(
      <NewEventDrawerProvider>
        <Triggers />
      </NewEventDrawerProvider>
    )
    await user.click(screen.getByText("with"))
    const input = await screen.findByDisplayValue("roses")
    await user.type(input, "!")
    await user.click(screen.getByText("close"))
    await user.click(screen.getByText("plain"))
    expect(await screen.findByDisplayValue("roses!")).toBeInTheDocument()
  })
})
