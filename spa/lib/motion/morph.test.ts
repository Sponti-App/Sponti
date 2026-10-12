import { describe, expect, it } from "vitest"
import { cubicBezier, morphFrame, openSlotAt, SHEET_EASE } from "./morph"

// The nav's 44px circle, centred at (195, 790); the 343 × 56 strip above it.
const button = { left: 173, top: 768, width: 44, height: 44 }
const slot = { left: 16, top: 760, width: 343, height: 56 }
const knob = { inset: 4, size: 48 }

describe("morphFrame (#376): the nav button becomes the strike strip", () => {
  it("starts as the button: a circle on the button, at its size", () => {
    const f = morphFrame(button, slot, 0, knob)
    // The knob's centre (16 + 4 + 24, 788) is moved onto the button's (195, 790).
    expect(f.transform).toBe("translate(151px, 2px) scale(0.92)")
    expect(f.transformOrigin).toBe("28px 50%")
    // Clipped to the 56px circle around the knob.
    expect(f.clipPath).toBe("inset(0px 287px 0px 0px round 9999px)")
  })

  it("ends as the strip in its slot, unclipped", () => {
    const f = morphFrame(button, slot, 1, knob)
    expect(f.transform).toBe("translate(0px, 0px) scale(1)")
    expect(f.clipPath).toBe("inset(0px 0px 0px 0px round 9999px)")
    expect([f.left, f.top, f.width, f.height]).toEqual([16, 760, 343, 56])
  })

  it("is half way in between", () => {
    const f = morphFrame(button, slot, 0.5, knob)
    expect(f.transform).toBe("translate(75.5px, 1px) scale(0.96)")
    expect(f.clipPath).toBe("inset(0px 143.5px 0px 0px round 9999px)")
  })
})

describe("openSlotAt (#376): the open morph aims at where the strip rests", () => {
  const rest = { left: 16, top: 737, width: 343, height: 56 }
  // The sheet is still sliding in: the live strip is below the screen.
  const live = { left: 16, top: 919, width: 343, height: 56 }

  it("aims at the resting slot, not the live strip, for most of the way", () => {
    for (const t of [0, 0.25, 0.5, 0.75]) {
      expect(openSlotAt(rest, live, t).top).toBe(737)
    }
  })

  it("meets the live strip as the morph ends, so the hand-over can't jump", () => {
    expect(openSlotAt(rest, { ...live, top: 739 }, 1).top).toBe(739)
  })

  it("eases onto it without overshooting either one", () => {
    let prev = 737
    for (let t = 0.75; t <= 1.0001; t += 0.05) {
      const top = openSlotAt(rest, live, t).top
      expect(top).toBeGreaterThanOrEqual(prev)
      expect(top).toBeLessThanOrEqual(919)
      prev = top
    }
  })

  it("is the resting slot when there is no live strip", () => {
    expect(openSlotAt(rest, null, 1)).toEqual(rest)
  })
})

describe("cubicBezier (#376): the clone moves on the sheet's curve", () => {
  it("runs from 0 to 1", () => {
    expect(SHEET_EASE(0)).toBe(0)
    expect(SHEET_EASE(1)).toBe(1)
  })

  it("never overshoots and only moves forward", () => {
    let prev = 0
    for (let t = 0; t <= 1; t += 0.01) {
      const v = SHEET_EASE(t)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      expect(v).toBeLessThanOrEqual(1)
      prev = v
    }
  })

  it("matches known points of a css curve", () => {
    const linear = cubicBezier(0, 0, 1, 1)
    expect(linear(0.3)).toBeCloseTo(0.3, 4)
    // ease-out (0, 0, 0.58, 1) at x = 0.5 is about 0.6846.
    expect(cubicBezier(0, 0, 0.58, 1)(0.5)).toBeCloseTo(0.6846, 3)
    // vaul's curve is fast at first: most of the way by mid-time.
    expect(SHEET_EASE(0.5)).toBeGreaterThan(0.9)
  })
})
