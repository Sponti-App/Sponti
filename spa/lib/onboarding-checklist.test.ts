import { describe, expect, it, vi } from "vitest"
import type { HostedEvent } from "@/lib/api/events"
import {
  checklistView,
  emitFriendsChanged,
  friendsHereLabel,
  needsFirstFriendFirst,
  pickHostedFlare,
  subscribeToFriendsChanged,
} from "./onboarding-checklist"

const NOW = Date.parse("2026-06-15T12:00:00.000Z")
const MIN = 60_000

function hosted(
  title: string,
  startOffsetMin: number,
  endOffsetMin: number
): HostedEvent {
  return {
    id: title,
    title,
    type: "drinks",
    startAt: new Date(NOW + startOffsetMin * MIN).toISOString(),
    endAt: new Date(NOW + endOffsetMin * MIN).toISOString(),
    locationLabel: "somewhere",
    audienceLabel: "all friends",
    attendeeCount: 0,
    attendingCount: 0,
    guestLimit: 0,
  } as HostedEvent
}

describe("pickHostedFlare (#459)", () => {
  it("is null for an account that never lit one", () => {
    expect(pickHostedFlare({ hostedByMe: [], pastHosted: [] }, NOW)).toBeNull()
  })

  it("prefers a live flare over an upcoming one", () => {
    expect(
      pickHostedFlare(
        {
          hostedByMe: [hosted("later", 60, 120), hosted("now", -5, 60)],
          pastHosted: [],
        },
        NOW
      )
    ).toEqual({ title: "now", live: true })
  })

  it("counts an upcoming flare, then one that ended", () => {
    expect(
      pickHostedFlare(
        { hostedByMe: [hosted("later", 60, 120)], pastHosted: [] },
        NOW
      )
    ).toEqual({ title: "later", live: false })
    expect(
      pickHostedFlare(
        { hostedByMe: [], pastHosted: [hosted("yesterday", -1500, -1400)] },
        NOW
      )
    ).toEqual({ title: "yesterday", live: false })
  })
})

describe("friendsHereLabel (#459)", () => {
  it("names up to three friends, then counts the rest", () => {
    expect(friendsHereLabel(["mia"])).toBe("mia's here")
    expect(friendsHereLabel(["mia", "sam"])).toBe("mia and sam are here")
    expect(friendsHereLabel(["lena", "mia", "sam"])).toBe(
      "lena, mia and sam are here"
    )
    expect(friendsHereLabel(["lena", "mia", "sam", "jo", "ali"])).toBe(
      "lena, mia and 3 more are here"
    )
  })
})

describe("checklistView (#459): the prototype's four states", () => {
  const LIT = { title: "drinks at the canal", live: true }
  const IDEA = "market lunch at the maybachufer"
  const THREE = ["lena", "mia", "sam"]

  it("waits for both facts", () => {
    expect(
      checklistView({
        friendNames: undefined,
        hostedFlare: null,
        ideaTitle: IDEA,
      })
    ).toEqual({ kind: "loading" })
    expect(
      checklistView({
        friendNames: [],
        hostedFlare: undefined,
        ideaTitle: IDEA,
      })
    ).toEqual({ kind: "loading" })
  })

  it("0 friends, lit: the flare row is done, the friend row says why", () => {
    expect(
      checklistView({ friendNames: [], hostedFlare: LIT, ideaTitle: IDEA })
    ).toEqual({
      kind: "open",
      flare: {
        done: true,
        current: false,
        hint: "drinks at the canal is live",
      },
      friend: {
        done: false,
        current: true,
        hint: "flares only go to friends, and you have none here yet",
      },
    })
  })

  it("0 friends, not now: both rows open, the friend row is current", () => {
    expect(
      checklistView({ friendNames: [], hostedFlare: null, ideaTitle: IDEA })
    ).toEqual({
      kind: "open",
      flare: { done: false, current: false, hint: `idea nearby: ${IDEA}` },
      friend: { done: false, current: true, hint: "flares only go to friends" },
    })
  })

  it("3 friends, lit: you're set", () => {
    expect(
      checklistView({ friendNames: THREE, hostedFlare: LIT, ideaTitle: IDEA })
    ).toEqual({ kind: "done", friendCount: 3 })
  })

  it("3 friends, not now: the friend row is done, the flare row is current", () => {
    expect(
      checklistView({ friendNames: THREE, hostedFlare: null, ideaTitle: null })
    ).toEqual({
      kind: "open",
      flare: {
        done: false,
        current: true,
        hint: "right now, or at a time you pick",
      },
      friend: {
        done: true,
        current: false,
        hint: "lena, mia and sam are here",
      },
    })
  })

  it("names a flare that isn't live yet as lit", () => {
    const view = checklistView({
      friendNames: [],
      hostedFlare: { title: "football", live: false },
      ideaTitle: null,
    })
    expect(view.kind === "open" && view.flare.hint).toBe("you lit football")
  })
})

describe("needsFirstFriendFirst (#459)", () => {
  it("is true with no friends, or an unknown count", () => {
    expect(needsFirstFriendFirst(0)).toBe(true)
    expect(needsFirstFriendFirst(null)).toBe(true)
  })

  it("is false with a friend", () => {
    expect(needsFirstFriendFirst(1)).toBe(false)
    expect(needsFirstFriendFirst(3)).toBe(false)
  })
})

describe("friends changed (#459)", () => {
  it("tells every listener until it unsubscribes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToFriendsChanged(listener)
    emitFriendsChanged()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    emitFriendsChanged()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
