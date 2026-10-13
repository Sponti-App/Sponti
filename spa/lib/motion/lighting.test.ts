import { afterEach, describe, expect, it, vi } from "vitest"
import {
  burstFor,
  dotRing,
  hasLitOnDevice,
  judgeStrike,
  launchPath,
  lightingSteps,
  markLitOnDevice,
  pickLightingTake,
  STRIKE,
  toneFor,
  wickPath,
} from "./lighting"

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("pickLightingTake (#376): the launch only for a known first flare", () => {
  it("plays the launch when no hosted flares loaded and none on this device", () => {
    expect(
      pickLightingTake({
        hostedLoaded: true,
        hostedCount: 0,
        litOnDevice: false,
      })
    ).toBe("launch")
  })

  it("plays the wick once the person hosts or has hosted a flare", () => {
    expect(
      pickLightingTake({
        hostedLoaded: true,
        hostedCount: 1,
        litOnDevice: false,
      })
    ).toBe("wick")
  })

  it("plays the wick when this device lit a flare before", () => {
    expect(
      pickLightingTake({
        hostedLoaded: true,
        hostedCount: 0,
        litOnDevice: true,
      })
    ).toBe("wick")
  })

  it("plays the wick when the hosted flares never loaded", () => {
    expect(
      pickLightingTake({
        hostedLoaded: false,
        hostedCount: 0,
        litOnDevice: false,
      })
    ).toBe("wick")
  })
})

describe("the device's lit flag", () => {
  it("is unset, then set", () => {
    expect(hasLitOnDevice()).toBe(false)
    markLitOnDevice()
    expect(hasLitOnDevice()).toBe(true)
  })

  it("survives storage that throws", () => {
    // Swap the whole object: a spy on jsdom's localStorage instance stores a
    // key instead of replacing the method, and Node 22 in CI hits that.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    })
    expect(() => markLitOnDevice()).not.toThrow()
    expect(hasLitOnDevice()).toBe(false)
  })
})

describe("burst and colour", () => {
  it("gives the first flare the full burst and later flares the soft one", () => {
    expect(burstFor("launch")).toBe("full")
    expect(burstFor("wick")).toBe("soft")
  })

  it("takes the pin's colour from who can join", () => {
    expect(toneFor("public")).toBe("open")
    expect(toneFor("private")).toBe("invite")
  })
})

describe("lightingSteps: reduced motion is cross-fades only", () => {
  it("plays the fuse and the burst with full motion", () => {
    expect(lightingSteps("wick", false)).toEqual([
      "fuse",
      "burst",
      "hold",
      "fade-out",
    ])
    expect(lightingSteps("launch", false)).toEqual([
      "fuse",
      "burst",
      "dots",
      "hold",
      "fade-out",
    ])
  })

  it("never travels or bursts under reduced motion", () => {
    for (const take of ["wick", "launch"] as const) {
      const steps = lightingSteps(take, true)
      expect(steps).not.toContain("fuse")
      expect(steps).not.toContain("burst")
      expect(steps[0]).toBe("fade-in")
      expect(steps.at(-1)).toBe("fade-out")
    }
    expect(lightingSteps("launch", true)).toContain("dots")
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

describe("shapes", () => {
  const from = { x: 195, y: 790 }
  const to = { x: 195, y: 350 }

  it("runs the wick from the flare button to the flare", () => {
    const d = wickPath(from, to, 70)
    expect(d.startsWith("M195 790 ")).toBe(true)
    expect(d.endsWith(" 195 350")).toBe(true)
    expect(d.match(/C/g)).toHaveLength(2)
  })

  it("runs the launch on one curve", () => {
    const d = launchPath(from, to, 60)
    expect(d.startsWith("M195 790 ")).toBe(true)
    expect(d.endsWith(" 195 350")).toBe(true)
    expect(d.match(/C/g)).toHaveLength(1)
  })

  it("puts the dots on an even, tight ring around the flare", () => {
    const center = { x: 100, y: 100 }
    const dots = dotRing(center, 62)
    expect(dots).toHaveLength(5)
    for (const d of dots) {
      expect(Math.hypot(d.x - center.x, d.y - center.y)).toBeCloseTo(62, 0)
    }
    expect(dots[0]).toEqual({ x: 100, y: 38 })
  })
})
