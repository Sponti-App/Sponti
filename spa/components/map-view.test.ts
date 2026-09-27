import { describe, it, expect } from "vitest"
import { bottomOccupiedCss } from "./map-view"

// --sponti-bottom-occupied is the distance from the viewport bottom to the
// top of the map sheet, so bottom-docked UI outside the map (the
// action-feedback toast) can sit above it. See #112.
describe("bottomOccupiedCss", () => {
  it("mini: reserves the nav plus the mini sheet, since the sheet sits above the nav", () => {
    expect(bottomOccupiedCss("mini")).toBe(
      "calc(var(--sponti-nav-h, 64px) + 64px)"
    )
  })

  it("peek: reserves only the peek sheet's own height, since it sits at bottom: 0 and already covers the nav", () => {
    expect(bottomOccupiedCss("peek")).toBe("268px")
  })

  it("expanded: reserves just the nav, so bottom-docked UI floats above the nav rather than the tall sheet", () => {
    expect(bottomOccupiedCss("expanded")).toBe("var(--sponti-nav-h, 64px)")
  })
})
