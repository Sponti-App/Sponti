import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const isNativePlatform = vi.fn()
const selectionChanged = vi.fn()
const impact = vi.fn()
const notification = vi.fn()

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}))

vi.mock("@capacitor/haptics", () => ({
  Haptics: { selectionChanged, impact, notification },
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
}))

import { haptic } from "./haptics"

function setVibrate(value: unknown) {
  Object.defineProperty(navigator, "vibrate", {
    value,
    configurable: true,
    writable: true,
  })
}

describe("haptic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // jsdom has no vibrate by default; remove whatever a test installed.
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  describe("native", () => {
    beforeEach(() => {
      isNativePlatform.mockReturnValue(true)
    })

    it("uses Capacitor and never touches navigator.vibrate", async () => {
      const vibrate = vi.fn()
      setVibrate(vibrate)

      await haptic("selection")
      await haptic("medium")
      await haptic("success")

      expect(selectionChanged).toHaveBeenCalledTimes(1)
      expect(impact).toHaveBeenCalledWith({ style: "MEDIUM" })
      expect(notification).toHaveBeenCalledWith({ type: "SUCCESS" })
      expect(vibrate).not.toHaveBeenCalled()
    })
  })

  describe("web", () => {
    beforeEach(() => {
      isNativePlatform.mockReturnValue(false)
    })

    it("vibrates with a short pattern per style", async () => {
      const vibrate = vi.fn().mockReturnValue(true)
      setVibrate(vibrate)

      await haptic("selection")
      await haptic("light")
      await haptic("medium")
      await haptic("heavy")
      await haptic("success")
      await haptic("warning")
      await haptic("error")

      const patterns = vibrate.mock.calls.map((c) => c[0])
      expect(patterns).toHaveLength(7)
      // Every pattern is short (under half a second in total).
      for (const p of patterns) {
        const total = Array.isArray(p)
          ? p.reduce((a: number, b: number) => a + b, 0)
          : p
        expect(total).toBeGreaterThan(0)
        expect(total).toBeLessThan(500)
      }
      // Heavier impacts last longer than lighter ones.
      expect(patterns[0]).toBeLessThan(patterns[1])
      expect(patterns[1]).toBeLessThan(patterns[2])
      expect(patterns[2]).toBeLessThan(patterns[3])
      // Notifications are multi-pulse so they feel distinct from impacts.
      expect(Array.isArray(patterns[4])).toBe(true)
      expect(Array.isArray(patterns[5])).toBe(true)
      expect(Array.isArray(patterns[6])).toBe(true)
      expect(selectionChanged).not.toHaveBeenCalled()
    })

    it("defaults to the selection pattern", async () => {
      const vibrate = vi.fn()
      setVibrate(vibrate)
      await haptic()
      expect(vibrate).toHaveBeenCalledTimes(1)
    })

    it("is a silent no-op when navigator.vibrate is unsupported", async () => {
      expect("vibrate" in navigator).toBe(false)
      await expect(haptic("success")).resolves.toBeUndefined()
      expect(selectionChanged).not.toHaveBeenCalled()
      expect(impact).not.toHaveBeenCalled()
      expect(notification).not.toHaveBeenCalled()
    })

    it("never throws when navigator.vibrate throws", async () => {
      setVibrate(
        vi.fn(() => {
          throw new Error("blocked")
        })
      )
      await expect(haptic("heavy")).resolves.toBeUndefined()
    })
  })
})
