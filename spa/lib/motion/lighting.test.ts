import { afterEach, describe, expect, it, vi } from "vitest"
import {
  hasLitOnDevice,
  judgeStrike,
  markLitOnDevice,
  pickBurst,
  STRIKE,
  toneFor,
} from "./lighting"

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("pickBurst (#376): the full burst only for a known first flare", () => {
  it("is full when no hosted flares loaded and none on this device", () => {
    expect(
      pickBurst({ hostedLoaded: true, hostedCount: 0, litOnDevice: false })
    ).toBe("full")
  })

  it("is soft once the person hosts or has hosted a flare", () => {
    expect(
      pickBurst({ hostedLoaded: true, hostedCount: 1, litOnDevice: false })
    ).toBe("soft")
  })

  it("is soft when this device lit a flare before", () => {
    expect(
      pickBurst({ hostedLoaded: true, hostedCount: 0, litOnDevice: true })
    ).toBe("soft")
  })

  it("is soft when the hosted flares never loaded", () => {
    expect(
      pickBurst({ hostedLoaded: false, hostedCount: 0, litOnDevice: false })
    ).toBe("soft")
  })
})

describe("the device's lit flag", () => {
  it("is unset, then set", () => {
    expect(hasLitOnDevice()).toBe(false)
    markLitOnDevice()
    expect(hasLitOnDevice()).toBe(true)
  })

  it("survives storage that throws", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(() => markLitOnDevice()).not.toThrow()
    expect(hasLitOnDevice()).toBe(false)
  })
})

describe("colour", () => {
  it("takes the pin's colour from who can join", () => {
    expect(toneFor("public")).toBe("open")
    expect(toneFor("private")).toBe("invite")
  })
})

describe("judgeStrike", () => {
  const range = 300

  it("lights on a fast, long flick", () => {
    expect(judgeStrike({ travelled: 240, range, elapsedMs: 200 })).toBe(
      "strike"
    )
  })

  it("lights on a plain tap, the accessible alternative", () => {
    expect(judgeStrike({ travelled: 0, range, elapsedMs: 900 })).toBe("tap")
    expect(
      judgeStrike({ travelled: STRIKE.tapSlop - 1, range, elapsedMs: 50 })
    ).toBe("tap")
  })

  it("fizzles on a slow drag", () => {
    expect(judgeStrike({ travelled: 240, range, elapsedMs: 2000 })).toBe(
      "fizzle"
    )
  })

  it("fizzles on a short flick", () => {
    expect(judgeStrike({ travelled: 60, range, elapsedMs: 40 })).toBe("fizzle")
  })
})
