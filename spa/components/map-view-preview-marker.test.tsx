import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EventItem } from "@/lib/api/events"

// The real AdvancedMarker needs the Google Maps JS API. This stand-in keeps
// the props the popover hands it, and wires a DOM click on the marker to
// `onClick` the way a desktop mouse click reaches Google's marker click.
const marker = vi.hoisted(() => ({
  props: null as null | {
    clickable?: boolean
    onClick?: (e: unknown) => void
  },
}))

vi.mock("@vis.gl/react-google-maps", () => ({
  AdvancedMarker: (props: {
    clickable?: boolean
    onClick?: (e: unknown) => void
    children?: ReactNode
  }) => {
    marker.props = props
    return (
      <div data-testid="marker" onClick={() => props.onClick?.({})}>
        {props.children}
      </div>
    )
  },
  AdvancedMarkerAnchorPoint: { CENTER: ["50%", "50%"] },
  APILoadingStatus: { FAILED: "FAILED" },
  Map: () => null,
  useApiLoadingStatus: () => "LOADED",
  useMap: () => null,
  useMapsLibrary: () => null,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))
vi.mock("@/components/new-event-drawer-provider", () => ({
  useNewEventDrawer: () => ({ open: false, openDrawer: vi.fn() }),
}))
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

import { FlarePreviewMarker } from "./map-view"

const flare = {
  id: "e1",
  title: "drinks after work",
  type: "drinks",
  startAt: "2026-06-15T12:00:00.000Z",
  endAt: "2026-06-15T13:00:00.000Z",
  visibility: "private",
  going: 2,
  host: { id: "h", name: "sarah kim", avatar: "s" },
  location: { name: "the usual spot", coordinates: [13.4, 52.5] },
} as unknown as EventItem

// #314: on the real map, a tap on the popover only arrives as Google's
// marker click. The marker must be clickable, and that click opens the flare.
describe("FlarePreviewMarker", () => {
  const onOpen = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    marker.props = null
    render(
      <FlarePreviewMarker
        event={flare}
        position={{ lat: 52.5, lng: 13.4 }}
        now={Date.parse("2026-06-15T12:20:00.000Z")}
        onOpen={onOpen}
        onClose={onClose}
      />
    )
  })

  it("is a clickable marker", () => {
    expect(marker.props?.clickable).toBe(true)
    expect(marker.props?.onClick).toBeTypeOf("function")
  })

  it("opens the flare on the marker click alone, with no DOM click", () => {
    fireEvent.pointerDown(screen.getByText("drinks after work"))
    marker.props?.onClick?.({})
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it("opens the flare once on a click anywhere on the card", async () => {
    await userEvent.click(screen.getByText("drinks after work"))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it("only closes when the close button is pressed", async () => {
    await userEvent.click(screen.getByRole("button", { name: "close" }))
    expect(onClose).toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  // #315: the band carries the category as an icon with an accessible name,
  // never the word, plus who can join.
  it("shows the category icon and who can join in the band", () => {
    const band = document.querySelector("[data-popover-band]") as HTMLElement
    expect(band).toHaveTextContent("invite only")
    expect(band).not.toHaveTextContent("drinks")
    expect(screen.getByRole("img", { name: "drinks" })).toBeInTheDocument()
    expect(
      within(band).getByRole("button", { name: "close" })
    ).toBeInTheDocument()
  })

  it("shows the time left and the host line without a location", () => {
    expect(screen.getByText("live · ends in 40 min")).toBeInTheDocument()
    expect(screen.getByText("by sarah · 2 going")).toBeInTheDocument()
    expect(screen.queryByText("the usual spot")).toBeNull()
  })

  it("only closes when a press on close arrives as the marker click", () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "close" }))
    marker.props?.onClick?.({})
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
