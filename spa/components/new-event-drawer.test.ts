import { describe, it, expect } from "vitest"
import {
  snapFloorForState,
  snapVisibleHeightCss,
  sheetBottomCss,
  inferEventType,
  resolveEventType,
  buildTimeRange,
} from "./new-event-drawer"
import { visibleSlotHeight } from "@/lib/use-sheet-visible-height"

describe("snapFloorForState", () => {
  it("returns peek when no section is expanded and mode is now", () => {
    expect(snapFloorForState(null, "now")).toBe("380px")
  })

  it("returns mid when a section is expanded in now mode", () => {
    expect(snapFloorForState("when", "now")).toBe(0.7)
    expect(snapFloorForState("where", "now")).toBe(0.7)
    expect(snapFloorForState("who", "now")).toBe(0.7)
  })

  it("returns tall when mode is scheduled regardless of section", () => {
    expect(snapFloorForState(null, "scheduled")).toBe(0.93)
    expect(snapFloorForState("when", "scheduled")).toBe(0.93)
    expect(snapFloorForState("where", "scheduled")).toBe(0.93)
  })
})

describe("snapVisibleHeightCss", () => {
  it("passes pixel snap points through unchanged", () => {
    expect(snapVisibleHeightCss("380px")).toBe("380px")
  })

  // Regression guard for issue #94: `vh` is the *large* viewport on iOS Safari,
  // so it overshoots the height vaul snapped against and hides the pinned CTA
  // behind the browser toolbar. Fractional snaps must resolve against
  // --sponti-vvh (window.innerHeight), which is vaul's own basis.
  it("resolves fractional snap points against the measured viewport height", () => {
    expect(snapVisibleHeightCss(0.7)).toBe(
      "calc(0.7 * var(--sponti-vvh, 100vh))"
    )
    expect(snapVisibleHeightCss(0.93)).toBe(
      "calc(0.93 * var(--sponti-vvh, 100vh))"
    )
  })

  it("does not subtract the bottom nav height", () => {
    // The sheet is modal and covers the nav, so the nav is neither visible nor
    // interactive while composing; reserving space for it left a dead gap.
    expect(snapVisibleHeightCss(0.7)).not.toContain("--sponti-nav-h")
    expect(snapVisibleHeightCss("380px")).not.toContain("--sponti-nav-h")
  })

  it("falls back to peek when the active snap is null", () => {
    expect(snapVisibleHeightCss(null)).toBe("380px")
  })
})

// The sheet's on-screen position is CSS arithmetic over two custom properties
// feeding vaul's transform, so resolve it numerically rather than
// string-matching: `calc()` becomes a plain group and `min` becomes Math.min,
// which makes the JS expression evaluate to the px value a browser would.
function resolvePx(
  css: string,
  vars: { vvh: number; kbInset: number }
): number {
  const substituted = css
    .replace(/var\(--sponti-vvh,[^)]*\)/g, `${vars.vvh}px`)
    .replace(/var\(--sponti-kb-inset,[^)]*\)/g, `${vars.kbInset}px`)
  if (substituted.includes("var(")) {
    throw new Error(`unsubstituted custom property in: ${css}`)
  }
  const js = substituted
    .replace(/\bcalc\(/g, "(")
    .replace(/\bmin\(/g, "Math.min(")
    .replace(/(\d)px\b/g, "$1")
  return Function(`"use strict"; return (${js})`)() as number
}

describe("sheet geometry under the software keyboard", () => {
  const VVH = 745
  const KEYBOARD = 336

  // Reproduces what the browser ends up rendering: vaul translates a
  // viewport-height sheet down by (viewport − snap), sheetBottomCss lifts it,
  // and useSheetVisibleHeight sizes the card to whatever of it is on screen.
  function layout(snap: number | string, kbInset: number) {
    const vars = { vvh: VVH, kbInset }
    const snapPx = resolvePx(snapVisibleHeightCss(snap), vars)
    const bottom = resolvePx(sheetBottomCss(snap), vars)

    // `h-full` sheet, offset from the bottom edge, then vaul's transform.
    const translate = VVH - snapPx
    const sheet = {
      top: -bottom + translate,
      bottom: VVH - bottom + translate,
    }
    const viewport = { top: 0, bottom: VVH - kbInset }

    const top = sheet.top
    return { top, height: visibleSlotHeight(sheet, viewport), snapPx }
  }

  describe.each([
    ["peek", "380px" as const],
    ["mid", 0.7],
    ["tall", 0.93],
  ])("%s detent", (_label, snap) => {
    it("sits flush on the bottom edge with no keyboard", () => {
      const { top, height } = layout(snap, 0)
      expect(top + height).toBe(VVH)
    })

    // Weaker than it looks — a sliver of sheet also satisfies this. The
    // disappearance itself came from vaul's own writes, which this arithmetic
    // cannot model; opting out of those is guarded in the render tests. What
    // this pins is that our lift never pushes the header off the top.
    it("stays on screen with a keyboard up", () => {
      const { top, height } = layout(snap, KEYBOARD)
      expect(top).toBeGreaterThanOrEqual(0)
      expect(height).toBeGreaterThan(0)
    })

    it("rests the card on top of the keyboard", () => {
      const { top, height } = layout(snap, KEYBOARD)
      expect(top + height).toBe(VVH - KEYBOARD)
    })

    it("keeps the card as tall as the space allows", () => {
      const { height, snapPx } = layout(snap, KEYBOARD)
      expect(height).toBe(Math.min(snapPx, VVH - KEYBOARD))
    })
  })

  it("holds peek at its full height, lifting rather than shrinking", () => {
    // 380px fits above a 336px keyboard in a 745px viewport, so nothing is lost.
    expect(layout("380px", KEYBOARD).height).toBe(380)
    expect(layout("380px", KEYBOARD).top).toBe(
      layout("380px", 0).top - KEYBOARD
    )
  })

  it("trades height for position once the sheet runs out of room", () => {
    // Tall cannot fit above the keyboard: it stops at the top of the viewport
    // and gives up height instead of sliding its header off the top.
    expect(layout(0.93, KEYBOARD).top).toBe(0)
    expect(layout(0.93, KEYBOARD).height).toBeLessThan(layout(0.93, 0).height)
  })

  it("does not lift the sheet at all when no keyboard is up", () => {
    for (const snap of ["380px", 0.7, 0.93] as const) {
      expect(resolvePx(sheetBottomCss(snap), { vvh: VVH, kbInset: 0 })).toBe(0)
    }
  })
})

describe("inferEventType", () => {
  it("returns null for empty string", () => {
    expect(inferEventType("")).toBeNull()
  })

  it("infers drinks for bar-related titles", () => {
    expect(inferEventType("beers at the pub")).toBe("drinks")
    expect(inferEventType("cocktails tonight")).toBe("drinks")
  })

  it("infers food for dining titles", () => {
    expect(inferEventType("pizza night")).toBe("food")
    expect(inferEventType("brunch at cafe")).toBe("food")
  })

  it("infers sports for activity titles", () => {
    expect(inferEventType("morning run")).toBe("sports")
    expect(inferEventType("tennis match")).toBe("sports")
  })

  it("infers hangout for casual titles", () => {
    expect(inferEventType("chill at the park")).toBe("hangout")
    expect(inferEventType("afternoon stroll")).toBe("hangout")
  })

  it("returns null when nothing matches", () => {
    expect(inferEventType("meeting about Q3")).toBeNull()
  })

  it("matches most-specific type first (drinks before hangout)", () => {
    expect(inferEventType("drinks and a hang")).toBe("drinks")
  })
})

describe("resolveEventType", () => {
  it("uses manual pick when present", () => {
    expect(resolveEventType("party", "drinks")).toBe("party")
  })

  it("falls back to inferred when no manual pick", () => {
    expect(resolveEventType(null, "food")).toBe("food")
  })

  it("falls back to hangout when both are null", () => {
    expect(resolveEventType(null, null)).toBe("hangout")
  })
})

describe("buildTimeRange", () => {
  it("computes now-mode range from createdAt + offset", () => {
    const result = buildTimeRange({
      mode: "now",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 0,
      startDate: "2026-07-15",
      startTimeMin: 0,
      durationMin: 60,
    })
    expect(result.startAt).toBe("2026-07-15T12:00:00.000Z")
    const endMs = new Date("2026-07-15T12:00:00.000Z").getTime() + 60 * 60_000
    expect(result.endAt).toBe(new Date(endMs).toISOString())
  })

  it("applies startOffsetMin for delayed now-mode starts", () => {
    const result = buildTimeRange({
      mode: "now",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 30,
      startDate: "2026-07-15",
      startTimeMin: 0,
      durationMin: 60,
    })
    const expectedStart =
      new Date("2026-07-15T12:00:00.000Z").getTime() + 30 * 60_000
    expect(result.startAt).toBe(new Date(expectedStart).toISOString())
  })

  it("computes scheduled-mode range from date + time", () => {
    const result = buildTimeRange({
      mode: "scheduled",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 0,
      startDate: "2026-07-15",
      startTimeMin: 19 * 60,
      durationMin: 120,
    })
    const start = new Date("2026-07-15T00:00:00")
    start.setMinutes(start.getMinutes() + 19 * 60)
    expect(result.startAt).toBe(start.toISOString())
    const end = new Date(start.getTime() + 120 * 60_000)
    expect(result.endAt).toBe(end.toISOString())
  })

  it("uses open-ended fallback (480min) when durationMin is null", () => {
    const result = buildTimeRange({
      mode: "now",
      createdAt: "2026-07-15T12:00:00.000Z",
      startOffsetMin: 0,
      startDate: "2026-07-15",
      startTimeMin: 0,
      durationMin: null,
    })
    const expectedEnd =
      new Date("2026-07-15T12:00:00.000Z").getTime() + 480 * 60_000
    expect(result.endAt).toBe(new Date(expectedEnd).toISOString())
  })
})
