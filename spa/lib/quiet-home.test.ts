import { describe, expect, it } from "vitest"
import type { Connection } from "@/lib/circles"
import { connectedAgo, recentConnections } from "@/lib/quiet-home"

const NOW = Date.parse("2026-10-09T12:00:00.000Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
const friend = (id: string, connectedAt?: string): Connection => ({
  id,
  displayName: id,
  username: id,
  connectedAt,
})

describe("recentConnections (#522)", () => {
  it("keeps the last 14 days, newest first, at most three", () => {
    const list = [
      friend("old", daysAgo(15)),
      friend("a", daysAgo(10)),
      friend("b", daysAgo(1)),
      friend("c", daysAgo(3)),
      friend("d", daysAgo(5)),
      friend("undated"),
    ]
    expect(recentConnections(list, NOW).map((c) => c.id)).toEqual([
      "b",
      "c",
      "d",
    ])
  })

  it("is empty when nobody is that recent", () => {
    expect(recentConnections([friend("old", daysAgo(30))], NOW)).toEqual([])
  })
})

describe("connectedAgo", () => {
  it("says it in words", () => {
    expect(connectedAgo(daysAgo(0), NOW)).toBe("today")
    expect(connectedAgo(daysAgo(1), NOW)).toBe("yesterday")
    expect(connectedAgo(daysAgo(4), NOW)).toBe("4 days ago")
    expect(connectedAgo(daysAgo(10), NOW)).toBe("last week")
  })
})
