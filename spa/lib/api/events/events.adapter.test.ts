import { describe, expect, it } from "vitest"
import {
  createEventRequestFromDraft,
  durationChipFor,
  editedEndAt,
  OPEN_ENDED,
  editedStartAt,
  inferEventStartShape,
} from "./events.adapter"
import type { DraftEvent } from "./events.types"

const MIN = 60_000
// Seconds and milliseconds on purpose: a flare lit "right now" keeps them.
const CREATED = "2026-07-15T12:00:37.123Z"

function at(offsetMin: number): string {
  return new Date(Date.parse(CREATED) + offsetMin * MIN).toISOString()
}

function nowDraft(overrides: Partial<DraftEvent> = {}): DraftEvent {
  return {
    mode: "now",
    eventType: "drinks",
    title: "park",
    durationMinutes: 60,
    startOffsetMinutes: 0,
    whereType: "search",
    location: { source: "place", name: "the park", coordinates: [13.4, 52.5] },
    guestLimit: 10,
    audience: "all",
    visibility: "public",
    allowForward: false,
    allowPlusOne: false,
    createdAt: CREATED,
    ...overrides,
  }
}

describe("createEventRequestFromDraft start offset (#312)", () => {
  it("starts a 30m-delayed, 1h flare 30 minutes after creation", () => {
    const body = createEventRequestFromDraft(
      nowDraft({ startOffsetMinutes: 30, durationMinutes: 60 }),
      { kind: "public" }
    )
    expect(body.startAt).toBe(at(30))
    expect(body.endAt).toBe(at(90))
  })

  it("starts at creation when the offset is 0", () => {
    const body = createEventRequestFromDraft(nowDraft(), { kind: "public" })
    expect(body.startAt).toBe(CREATED)
    expect(body.endAt).toBe(at(60))
  })
})

describe("inferEventStartShape (#330)", () => {
  const shapeFor = (startOffsetMin: number) =>
    inferEventStartShape({
      createdAt: CREATED,
      startAt: at(startOffsetMin),
      endAt: at(startOffsetMin + 60),
    })

  for (const offset of [0, 15, 30, 60]) {
    for (const drift of [-2, 0, 2]) {
      it(`reads a start ${offset} min ${drift >= 0 ? "+" : ""}${drift} after creation as right now + ${offset}`, () => {
        expect(shapeFor(offset + drift)).toEqual({
          mode: "now",
          startOffsetMinutes: offset,
          durationMinutes: 60,
        })
      })
    }
  }

  for (const offset of [-3, 3, 12, 27, 33, 45, 57, 63, 90]) {
    it(`reads a start ${offset} min from creation as scheduled`, () => {
      const shape = shapeFor(offset)
      expect(shape.mode).toBe("scheduled")
      expect(shape.startOffsetMinutes).toBeUndefined()
      expect(shape.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(shape.startTime).toMatch(/^\d{2}:\d{2}$/)
      expect(shape.durationMinutes).toBe(60)
    })
  }
})

describe("editedStartAt", () => {
  // 45 minutes isn't a "right now" offset, so this one edits as scheduled.
  const delayed = { createdAt: CREATED, startAt: at(45), endAt: at(105) }

  it("keeps a scheduled flare's exact start when the time isn't touched", () => {
    const shape = inferEventStartShape(delayed)
    expect(shape.mode).toBe("scheduled")
    expect(
      editedStartAt(delayed, shape.startDate ?? "", shape.startTime ?? "")
    ).toBe(delayed.startAt)
  })

  it("moves the start when the host picks another time", () => {
    const shape = inferEventStartShape(delayed)
    const [hh, mm] = (shape.startTime ?? "00:00").split(":").map(Number)
    const later = `${String((hh + 1) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
    const expected = new Date(`${shape.startDate}T${later}`).toISOString()
    expect(editedStartAt(delayed, shape.startDate ?? "", later)).toBe(expected)
  })

  it("keeps a flare lit for right now on its stored start", () => {
    const now = { createdAt: CREATED, startAt: CREATED, endAt: at(60) }
    expect(inferEventStartShape(now).mode).toBe("now")
    expect(editedStartAt(now, "", "")).toBe(CREATED)
  })

  it("keeps a right now + 30m flare's exact start when the offset isn't touched (#330)", () => {
    const lit = { createdAt: CREATED, startAt: at(31), endAt: at(91) }
    expect(inferEventStartShape(lit).startOffsetMinutes).toBe(30)
    expect(editedStartAt(lit, "", "")).toBe(lit.startAt)
    expect(editedStartAt(lit, "", "", 30)).toBe(lit.startAt)
  })

  it("starts a right now flare at creation + the new offset (#330)", () => {
    const lit = { createdAt: CREATED, startAt: at(30), endAt: at(90) }
    expect(editedStartAt(lit, "", "", 60)).toBe(at(60))
    expect(editedStartAt(lit, "", "", 15)).toBe(at(15))
    expect(editedStartAt(lit, "", "", 0)).toBe(CREATED)
  })
})

describe("durationChipFor (#340)", () => {
  it("selects the chip a stored length matches", () => {
    expect(durationChipFor(60, "now")).toBe(60)
    expect(durationChipFor(240, "now")).toBe(240)
    expect(durationChipFor(240, "scheduled")).toBe(240)
  })

  it("reads the open-ended fallback as open, for a right-now flare only", () => {
    expect(durationChipFor(8 * 60, "now")).toBe(OPEN_ENDED)
    expect(durationChipFor(8 * 60, "scheduled")).toBeNull()
  })

  it("selects nothing for a length no chip offers", () => {
    expect(durationChipFor(45, "now")).toBeNull()
    expect(durationChipFor(15, "scheduled")).toBeNull()
  })
})

describe("editedEndAt (#340)", () => {
  // A "right now" flare lit with a 30m delay, stored with seconds.
  const now = {
    createdAt: "2099-06-01T17:30:37.123Z",
    startAt: "2099-06-01T18:00:37.123Z",
    endAt: "2099-06-01T19:00:37.123Z",
  }

  it("keeps the stored end when nothing changed", () => {
    expect(editedEndAt(now, now.startAt, 60)).toBe(now.endAt)
    expect(editedEndAt(now, now.startAt, null)).toBe(now.endAt)
  })

  it("keeps an unmatched length to the millisecond", () => {
    const odd = { ...now, endAt: "2099-06-01T18:45:59.999Z" }
    expect(editedEndAt(odd, odd.startAt, null)).toBe(odd.endAt)
    expect(editedEndAt(odd, "2099-06-01T18:30:37.123Z", null)).toBe(
      "2099-06-01T19:15:59.999Z"
    )
  })

  it("carries the length along when only the start moves", () => {
    expect(editedEndAt(now, "2099-06-01T18:30:37.123Z", 60)).toBe(
      "2099-06-01T19:30:37.123Z"
    )
  })

  it("ends a newly picked length after the start", () => {
    expect(editedEndAt(now, now.startAt, 240)).toBe("2099-06-01T22:00:37.123Z")
  })

  it("saves open as the open-ended fallback after the start", () => {
    expect(editedEndAt(now, now.startAt, OPEN_ENDED)).toBe(
      "2099-06-02T02:00:37.123Z"
    )
  })
})
