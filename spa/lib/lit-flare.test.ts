import { describe, expect, it } from "vitest"
import type { EventItem } from "@/lib/api/events"
import {
  announceLitFlare,
  announceLitFocus,
  LIT_FLARE_HOLD_MS,
  releaseLitPin,
  subscribeToLitFlare,
  subscribeToLitFocus,
  subscribeToLitPinRelease,
  withLitFlares,
} from "./lit-flare"

const flare = (id: string) => ({ id }) as EventItem

describe("withLitFlares (#376): a flare just lit shows before the refetch has it", () => {
  const now = 1_000_000

  it("adds a lit flare the api's list hasn't returned yet", () => {
    const fetched = [flare("a")]
    const out = withLitFlares(fetched, [{ event: flare("b"), litAt: now }], now)
    expect(out.map((e) => e.id)).toEqual(["a", "b"])
  })

  it("takes the api's copy once it has it, and keeps the list as is", () => {
    const fetched = [flare("a"), flare("b")]
    const out = withLitFlares(fetched, [{ event: flare("b"), litAt: now }], now)
    expect(out).toBe(fetched)
  })

  it("lets go of it after the hold, when the api's list is the truth", () => {
    const fetched = [flare("a")]
    const lit = [{ event: flare("b"), litAt: now - LIT_FLARE_HOLD_MS }]
    expect(withLitFlares(fetched, lit, now)).toBe(fetched)
  })
})

describe("announceLitFlare", () => {
  it("reaches every subscriber until it unsubscribes", () => {
    const seen: string[] = []
    const off = subscribeToLitFlare((e) => seen.push(e.id))
    announceLitFlare(flare("x"))
    off()
    announceLitFlare(flare("y"))
    expect(seen).toEqual(["x"])
  })
})

describe("the takeover's messages (#376)", () => {
  it("tells the map whether to hold the new pin", () => {
    const seen: [string, boolean][] = []
    const off = subscribeToLitFlare((e, o) => seen.push([e.id, !!o.held]))
    announceLitFlare(flare("held"), { held: true })
    announceLitFlare(flare("shown"))
    off()
    expect(seen).toEqual([
      ["held", true],
      ["shown", false],
    ])
  })

  it("moves the map at the strike, and releases the pin at the hand-over", () => {
    const focus: number[] = []
    const released: string[] = []
    const offFocus = subscribeToLitFocus((c) => focus.push(c.lat))
    const offRelease = subscribeToLitPinRelease((id) => released.push(id))
    announceLitFocus({ lat: 52.5, lng: 13.4 })
    releaseLitPin("a")
    offFocus()
    offRelease()
    announceLitFocus({ lat: 1, lng: 1 })
    releaseLitPin("b")
    expect(focus).toEqual([52.5])
    expect(released).toEqual(["a"])
  })
})
