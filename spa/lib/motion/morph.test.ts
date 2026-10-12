import { describe, expect, it } from "vitest"
import { morphFrame } from "./morph"

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
