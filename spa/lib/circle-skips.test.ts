import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  CIRCLE_SKIPS_KEY,
  isCircleSkipped,
  rememberCircleSkip,
  resetCircleSkipsForTest,
} from "./circle-skips"

describe("circle skips (#597)", () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetCircleSkipsForTest()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("skips nobody by default", () => {
    expect(isCircleSkipped("maya")).toBe(false)
  })

  it("stores a skip per friend on the device and reads it back after a reload", () => {
    rememberCircleSkip("maya")
    expect(JSON.parse(window.localStorage.getItem(CIRCLE_SKIPS_KEY)!)).toEqual([
      "maya",
    ])
    resetCircleSkipsForTest() // a fresh page load: no memory, only storage
    expect(isCircleSkipped("maya")).toBe(true)
    expect(isCircleSkipped("jo")).toBe(false)
  })

  it("keeps the newest 200 when the list grows", () => {
    for (let i = 0; i < 205; i += 1) rememberCircleSkip(`user-${i}`)
    resetCircleSkipsForTest()
    expect(isCircleSkipped("user-0")).toBe(false)
    expect(isCircleSkipped("user-204")).toBe(true)
  })

  it("ignores stored values it can't read", () => {
    window.localStorage.setItem(CIRCLE_SKIPS_KEY, "not json")
    expect(isCircleSkipped("maya")).toBe(false)
    window.localStorage.setItem(CIRCLE_SKIPS_KEY, '{"maya":true}')
    expect(isCircleSkipped("maya")).toBe(false)
    window.localStorage.setItem(CIRCLE_SKIPS_KEY, '["maya", 3]')
    expect(isCircleSkipped("maya")).toBe(true)
  })

  it("survives a storage that throws: the skip holds for the session", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(isCircleSkipped("maya")).toBe(false)
    expect(() => rememberCircleSkip("maya")).not.toThrow()
    expect(isCircleSkipped("maya")).toBe(true)
  })
})
