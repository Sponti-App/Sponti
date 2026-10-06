import { describe, expect, it } from "vitest"
import { decideMobileGate, MOBILE_GATE_MODE } from "./mobile-gate"

// #467: who sees the "sponti is made for your phone" notice.

describe("decideMobileGate", () => {
  it("never gates a phone or tablet", () => {
    expect(decideMobileGate({ isDesktop: false, continued: false })).toBe("app")
    expect(
      decideMobileGate({ isDesktop: false, continued: false, mode: "block" })
    ).toBe("app")
  })

  it("shows the notice on a desktop until 'continue anyway' is remembered", () => {
    expect(
      decideMobileGate({ isDesktop: true, continued: false, mode: "warn" })
    ).toBe("notice")
    expect(
      decideMobileGate({ isDesktop: true, continued: true, mode: "warn" })
    ).toBe("app")
  })

  it("in block mode, a remembered choice does not open the app", () => {
    expect(
      decideMobileGate({ isDesktop: true, continued: true, mode: "block" })
    ).toBe("notice")
  })

  it("warns by default (Patrick can flip the one constant to block)", () => {
    expect(MOBILE_GATE_MODE).toBe("warn")
  })
})
