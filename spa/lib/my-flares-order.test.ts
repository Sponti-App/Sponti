import { describe, expect, it } from "vitest"
import type { HostedEvent } from "@/lib/api/events"
import { orderMyFlares } from "./my-flares-order"

const NOW = Date.parse("2026-10-14T18:00:00Z")
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

function flare(
  id: string,
  startMin: number,
  endMin: number,
  apiStatus: HostedEvent["apiStatus"] = "active"
): HostedEvent {
  return {
    id,
    startAt: at(startMin),
    endAt: at(endMin),
    apiStatus,
  } as HostedEvent
}

describe("orderMyFlares (#581)", () => {
  it("puts live flares first, newest on top, then upcoming soonest first", () => {
    const { active } = orderMyFlares(
      [
        flare("old-live", -180, 60),
        flare("next-week", 7 * 24 * 60, 7 * 24 * 60 + 60),
        flare("new-live", -5, 55),
        flare("tonight", 120, 180),
      ],
      NOW
    )
    expect(active.map((e) => e.id)).toEqual([
      "new-live",
      "old-live",
      "tonight",
      "next-week",
    ])
  })

  it("splits cancelled flares off, the most recent first", () => {
    const { active, cancelled } = orderMyFlares(
      [
        flare("cancelled-early", -120, 60, "cancelled"),
        flare("live", -10, 50),
        flare("cancelled-later", 60, 120, "cancelled"),
      ],
      NOW
    )
    expect(active.map((e) => e.id)).toEqual(["live"])
    expect(cancelled.map((e) => e.id)).toEqual([
      "cancelled-later",
      "cancelled-early",
    ])
  })
})
