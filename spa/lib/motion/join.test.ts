import { describe, expect, it } from "vitest"
import type { Notification } from "@/lib/notifications"
import {
  JOIN_END,
  JOIN_FLY_AT,
  JOIN_IMPACT,
  arcPoint,
  joinFrame,
  joinerNames,
  planJoinBeat,
} from "./join"

const notice = (
  id: string,
  over: Partial<NonNullable<Notification["rsvp"]>> & { actor?: string } = {}
): Notification => ({
  id,
  type: "event_rsvp_change",
  targetType: "event",
  targetId: "e1",
  title: "",
  subtitle: "",
  createdAt: new Date().toISOString(),
  readAt: null,
  read: false,
  href: "/event/e1",
  intent: "rsvp",
  actorName: over.actor ?? "mia",
  actorId: `user-${over.actor ?? "mia"}`,
  rsvp: {
    change: "joined",
    status: "going",
    firstJoin: false,
    eventTitle: "sunset swim",
    willArriveAt: null,
    arrivalStatus: null,
    ...over,
  },
})

describe("planJoinBeat", () => {
  it("plays the overlay for a first join, named with the flare", () => {
    expect(planJoinBeat([notice("n1", { firstJoin: true })])).toEqual({
      kind: "first",
      joiners: [{ id: "user-mia", name: "mia", avatarUrl: null }],
      title: "mia joined your flare",
      detail: "sunset swim",
    })
  })

  it("stacks everyone who joined in the same poll", () => {
    const beat = planJoinBeat([
      notice("n1", { firstJoin: true }),
      notice("n2", { actor: "jonas" }),
    ])
    expect(beat).toMatchObject({
      kind: "first",
      title: "mia and jonas joined your flare",
    })
  })

  it("only swings the bell for later joins", () => {
    expect(
      planJoinBeat([notice("n1"), notice("n2", { actor: "jonas" })])
    ).toEqual({ kind: "later" })
  })

  it("ignores leaves, arrival updates and other notifications", () => {
    expect(
      planJoinBeat([
        notice("n1", { change: "declined", status: "declined" }),
        notice("n2", { change: "arrival_updated" }),
        { ...notice("n3"), type: "event_invitation", rsvp: undefined },
      ])
    ).toBeNull()
  })

  it("names flares in the plural when the joins are on different flares", () => {
    const beat = planJoinBeat([
      notice("n1", { firstJoin: true }),
      notice("n2", { firstJoin: true, actor: "jonas", eventTitle: "chess" }),
    ])
    expect(beat).toMatchObject({
      title: "mia and jonas joined your flares",
      detail: null,
    })
  })
})

describe("joinerNames", () => {
  const j = (name: string) => ({ id: name, name, avatarUrl: null })
  it("lists up to three, then counts the rest", () => {
    expect(joinerNames([j("mia"), j("jonas"), j("leo")])).toBe(
      "mia, jonas and leo"
    )
    expect(joinerNames([j("a"), j("b"), j("c"), j("d")])).toBe(
      "a, b and 2 more"
    )
  })
})

describe("joinFrame", () => {
  const geo = { from: { x: 200, y: 200 }, to: { x: 120, y: 800 } }

  it("pops in, holds, then lands on the bell and goes", () => {
    expect(joinFrame(0, geo, false).body.opacity).toBe(0)
    const held = joinFrame(JOIN_FLY_AT - 1, geo, false)
    expect(held.body).toMatchObject({ x: 0, y: 0, opacity: 1 })
    expect(held.label.opacity).toBe(1)
    const landed = joinFrame(JOIN_IMPACT, geo, false)
    expect(landed.body.x).toBeCloseTo(-80)
    expect(landed.body.y).toBeCloseTo(600)
    expect(landed.label.opacity).toBe(0)
    expect(joinFrame(JOIN_END, geo, false).body.opacity).toBe(0)
  })

  it("trails sparks along the arc", () => {
    const mid = joinFrame(JOIN_FLY_AT + 400, geo, false)
    const lit = mid.sparks.filter((s) => s.opacity > 0)
    expect(lit.length).toBeGreaterThan(0)
    expect(
      joinFrame(JOIN_FLY_AT - 1, geo, false).sparks.every(
        (s) => s.opacity === 0
      )
    ).toBe(true)
    expect(arcPoint(geo.from, geo.to, 1)).toEqual(geo.to)
  })

  it("with reduced motion, only fades: nothing travels or scales", () => {
    for (const t of [0, 100, JOIN_FLY_AT, JOIN_IMPACT + 100]) {
      const f = joinFrame(t, geo, true)
      expect(f.body).toMatchObject({ x: 0, y: 0, scale: 1 })
      expect(f.sparks.every((s) => s.opacity === 0)).toBe(true)
    }
    expect(joinFrame(JOIN_IMPACT - 1, geo, true).body.opacity).toBe(1)
  })

  it("without a bell on screen, fades out where it is", () => {
    const f = joinFrame(JOIN_IMPACT, { ...geo, to: null }, false)
    expect(f.body).toMatchObject({ x: 0, y: 0, opacity: 0 })
  })
})
