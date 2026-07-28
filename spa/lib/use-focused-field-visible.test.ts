import { describe, it, expect } from "vitest"
import { revealOffset } from "./use-focused-field-visible"

// The scrollable compose area, as it ends up once the keyboard has taken most
// of the sheet: a short slot with the pinned CTA immediately below it.
const view = { top: 100, bottom: 300 }

describe("revealOffset", () => {
  it("leaves a comfortably visible field alone", () => {
    expect(revealOffset({ top: 150, bottom: 190 }, view)).toBe(0)
  })

  // The bug from the recording: tapping "my location" focuses the place search,
  // the keyboard shrinks the card, and the field ends up below the slot with
  // the CTA sitting where it used to be.
  it("scrolls down to reveal a field clipped by the bottom", () => {
    expect(revealOffset({ top: 320, bottom: 360 }, view)).toBe(72)
  })

  it("scrolls up to reveal a field clipped by the top", () => {
    expect(revealOffset({ top: 60, bottom: 100 }, view)).toBe(-52)
  })

  it("leaves a gap so the field does not sit flush against the edge", () => {
    // Field ends exactly on the bottom edge: technically visible, but touching
    // the CTA, so it still moves.
    const offset = revealOffset({ top: 260, bottom: 300 }, view)
    expect(offset).toBe(12)
  })

  it("shows the top of a field taller than the slot", () => {
    // Aligning the bottom would put the caret and label off-screen.
    expect(revealOffset({ top: 250, bottom: 700 }, view)).toBe(138)
  })

  it("is symmetric — reapplying after the scroll lands is a no-op", () => {
    const field = { top: 320, bottom: 360 }
    const offset = revealOffset(field, view)
    const settled = { top: field.top - offset, bottom: field.bottom - offset }
    expect(revealOffset(settled, view)).toBe(0)
  })
})
