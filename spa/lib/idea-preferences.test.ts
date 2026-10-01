import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  readIdeasHidden,
  resetIdeaPreferencesForTest,
  setIdeasHidden,
} from "./idea-preferences"

const KEY = "sponti.ideas.hidden.v1"

describe("idea preferences", () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetIdeaPreferencesForTest()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows ideas by default", () => {
    expect(readIdeasHidden()).toBe(false)
  })

  it("stores the choice on the device and reads it back after a reload", () => {
    setIdeasHidden(true)
    expect(window.localStorage.getItem(KEY)).toBe("1")
    resetIdeaPreferencesForTest() // a fresh page load: no memory, only storage
    expect(readIdeasHidden()).toBe(true)

    setIdeasHidden(false)
    expect(window.localStorage.getItem(KEY)).toBeNull()
    resetIdeaPreferencesForTest()
    expect(readIdeasHidden()).toBe(false)
  })

  it("ignores anything but the stored 1", () => {
    window.localStorage.setItem(KEY, "true")
    expect(readIdeasHidden()).toBe(false)
  })

  it("survives a storage that throws: reads show ideas, writes hold for the session", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(readIdeasHidden()).toBe(false)
    expect(() => setIdeasHidden(true)).not.toThrow()
    expect(readIdeasHidden()).toBe(true)
    expect(() => setIdeasHidden(false)).not.toThrow()
    expect(readIdeasHidden()).toBe(false)
  })
})
