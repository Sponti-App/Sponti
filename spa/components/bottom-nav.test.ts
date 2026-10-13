import { describe, expect, it } from "vitest"
import { isMyFlaresActive } from "./bottom-nav"

// #356: "my flares" is lit on the list and on flares you host.

const hosted = new Set(["mine-1"])

describe("isMyFlaresActive", () => {
  it("is active on the list", () => {
    expect(isMyFlaresActive("/event", hosted)).toBe(true)
  })

  it("is active on the page and edit page of a flare you host", () => {
    expect(isMyFlaresActive("/event/mine-1", hosted)).toBe(true)
    expect(isMyFlaresActive("/event/mine-1/edit", hosted)).toBe(true)
  })

  it("is off on someone else's flare, and before your flares have loaded", () => {
    expect(isMyFlaresActive("/event/theirs-1", hosted)).toBe(false)
    expect(isMyFlaresActive("/event/mine-1", new Set())).toBe(false)
  })

  it("is off elsewhere", () => {
    expect(isMyFlaresActive("/", hosted)).toBe(false)
    expect(isMyFlaresActive("/event/new", hosted)).toBe(false)
    expect(isMyFlaresActive("/circles", hosted)).toBe(false)
  })
})
