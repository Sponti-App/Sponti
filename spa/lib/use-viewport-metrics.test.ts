import { describe, it, expect } from "vitest"
import { keyboardInsetPx } from "./use-viewport-metrics"

describe("keyboardInsetPx", () => {
  it("reports no inset when the visual viewport fills the layout viewport", () => {
    expect(keyboardInsetPx(745, { height: 745, offsetTop: 0 })).toBe(0)
  })

  it("reports the covered height when the keyboard is up", () => {
    expect(keyboardInsetPx(745, { height: 409, offsetTop: 0 })).toBe(336)
  })

  // Safari pans the visual viewport within the layout viewport to reveal a
  // focused input; that shifts the overlap without changing either height.
  it("accounts for a visual viewport scrolled within the layout viewport", () => {
    expect(keyboardInsetPx(745, { height: 409, offsetTop: 50 })).toBe(286)
  })

  it("rounds sub-pixel viewport heights", () => {
    expect(keyboardInsetPx(745, { height: 408.5, offsetTop: 0 })).toBe(337)
  })

  it("never goes negative when the visual viewport is the taller of the two", () => {
    expect(keyboardInsetPx(745, { height: 800, offsetTop: 0 })).toBe(0)
  })

  it("reports no inset where visualViewport is unavailable", () => {
    expect(keyboardInsetPx(745, null)).toBe(0)
    expect(keyboardInsetPx(745, undefined)).toBe(0)
  })
})
