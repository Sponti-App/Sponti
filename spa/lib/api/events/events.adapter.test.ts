import { describe, expect, it } from "vitest"
import {
  createEventRequestFromDraft,
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

describe("editedStartAt", () => {
  const delayed = { createdAt: CREATED, startAt: at(30), endAt: at(90) }

  it("keeps a delayed flare's exact start when the time isn't touched", () => {
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
})
