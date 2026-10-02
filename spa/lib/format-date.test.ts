import { describe, expect, it } from "vitest"

import {
  formatClock,
  formatDayLong,
  formatDayShort,
  formatMonthName,
  formatWeekdayClock,
  formatWeekdayShort,
} from "./format-date"

// Sunday 4 October 2026, 12:42 and 00:05 local time (a Date built from parts
// is local, so the assertions don't depend on the machine's timezone).
const noon = new Date(2026, 9, 4, 12, 42)
const night = new Date(2026, 9, 4, 0, 5)

describe("format-date", () => {
  it("formatClock lowercases am/pm", () => {
    const text = formatClock(noon)
    expect(text).toBe(text.toLowerCase())
    expect(text).toMatch(/^12:42\s?pm$/)
    expect(formatClock(night)).toMatch(/^12:05\s?am$/)
  })

  it("formatClock takes an ISO string or a timestamp", () => {
    expect(formatClock(noon.toISOString())).toBe(formatClock(noon))
    expect(formatClock(noon.getTime())).toBe(formatClock(noon))
  })

  it("formatWeekdayShort is lowercase", () => {
    expect(formatWeekdayShort(noon)).toBe("sun")
  })

  it("formatDayShort is lowercase", () => {
    expect(formatDayShort(noon)).toBe("sun, oct 4")
  })

  it("formatDayLong is lowercase", () => {
    expect(formatDayLong(noon)).toBe("sunday, oct 4")
  })

  it("formatMonthName is lowercase", () => {
    expect(formatMonthName(noon)).toBe("october")
    expect(formatMonthName(new Date(2026, 0, 15))).toBe("january")
  })

  it("formatWeekdayClock joins the two", () => {
    expect(formatWeekdayClock(noon)).toMatch(/^sun 12:42\s?pm$/)
  })
})
