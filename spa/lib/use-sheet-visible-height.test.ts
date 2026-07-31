import { describe, expect, it } from "vitest"
import { visibleSlotHeight } from "./use-sheet-visible-height"

// A stand-in for a phone with a 700px viewport. vaul renders the sheet at full
// viewport height and translates it down by (viewport − snap), so a 380px snap
// puts the sheet's top at 320 and its bottom at 1020 — 320px of it below the
// fold. The visible slot is what the card must be sized to.
const VIEWPORT = { top: 0, bottom: 700 }

describe("visibleSlotHeight", () => {
  it("returns the snap height when the sheet is snapped and unobstructed", () => {
    expect(visibleSlotHeight({ top: 320, bottom: 1020 }, VIEWPORT)).toBe(380)
  })

  // The keyboard shrinks the visual viewport from the bottom. vaul lifts the
  // sheet above it, but the slot is smaller than the snap point — sizing the
  // card to 380px here is what clipped the pinned CTA.
  it("shrinks to the space above the software keyboard", () => {
    const withKeyboard = { top: 0, bottom: 380 }
    expect(visibleSlotHeight({ top: 100, bottom: 800 }, withKeyboard)).toBe(280)
  })

  // Safari can leave the sheet sitting below its snap point after the keyboard
  // closes. The card must follow the sheet down rather than keep a height that
  // strands the CTA under the browser toolbar.
  it("follows a sheet that has drifted below its snap point", () => {
    expect(visibleSlotHeight({ top: 470, bottom: 1170 }, VIEWPORT)).toBe(230)
  })

  it("clamps to zero for a sheet fully below the viewport", () => {
    expect(visibleSlotHeight({ top: 900, bottom: 1600 }, VIEWPORT)).toBe(0)
  })

  it("clips a sheet that extends above the visible viewport", () => {
    // visualViewport.offsetTop is non-zero when the page is scrolled within the
    // visual viewport; the slot starts at the viewport top, not the sheet top.
    const scrolled = { top: 150, bottom: 700 }
    expect(visibleSlotHeight({ top: 0, bottom: 700 }, scrolled)).toBe(550)
  })

  it("returns the full sheet when it sits entirely inside the viewport", () => {
    expect(visibleSlotHeight({ top: 300, bottom: 600 }, VIEWPORT)).toBe(300)
  })
})
