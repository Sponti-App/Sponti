import { beforeEach, describe, expect, it } from "vitest"
import type { Connection } from "@/lib/circles"
import {
  batchPeople,
  dismissRecentPeople,
  EMPTY_RECENT_PEOPLE,
  markFreshSignIn,
  newConnectionsSince,
  readRecentPeopleState,
  RECENT_PEOPLE_KEY,
  resetRecentPeopleMemory,
  settleRecentPeople,
  type RecentPeopleState,
} from "@/lib/quiet-home"

const NOW = Date.parse("2026-10-09T12:00:00.000Z")
const DAY = 86_400_000
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString()
const friend = (id: string, connectedAt?: string): Connection => ({
  id,
  displayName: id,
  username: id,
  connectedAt,
})
const ME = "me"
const fresh = (over: Partial<RecentPeopleState> = {}): RecentPeopleState => ({
  ...EMPTY_RECENT_PEOPLE,
  userId: ME,
  fresh: true,
  ...over,
})

beforeEach(() => {
  window.localStorage.clear()
  resetRecentPeopleMemory()
})

describe("newConnectionsSince", () => {
  it("keeps the ones after the mark, newest first, dated only", () => {
    const list = [
      friend("old", daysAgo(15)),
      friend("a", daysAgo(10)),
      friend("b", daysAgo(1)),
      friend("undated"),
    ]
    expect(
      newConnectionsSince(list, NOW - 14 * DAY, NOW).map((c) => c.id)
    ).toEqual(["b", "a"])
  })
})

describe("settleRecentPeople (#561)", () => {
  const three = [
    friend("a", daysAgo(3)),
    friend("b", daysAgo(1)),
    friend("c", daysAgo(2)),
    friend("d", daysAgo(4)),
  ]

  it("a fresh sign-in with 2+ new connections starts a batch of up to three", () => {
    const next = settleRecentPeople(fresh(), ME, three, NOW)
    expect(next).toEqual({
      userId: ME,
      fresh: false,
      lastAt: NOW,
      batch: ["b", "c", "a"],
    })
  })

  it("one new connection isn't enough, and the sign-in is used up", () => {
    const next = settleRecentPeople(
      fresh(),
      ME,
      [friend("a", daysAgo(1)), friend("old", daysAgo(30))],
      NOW
    )
    expect(next).toEqual({ ...fresh(), fresh: false })
  })

  it("without a fresh sign-in nothing shows", () => {
    const state = fresh({ fresh: false })
    expect(settleRecentPeople(state, ME, three, NOW)).toBe(state)
  })

  it("counts only connections since the card was last shown or dismissed", () => {
    const lastAt = NOW - 2.5 * DAY
    const next = settleRecentPeople(fresh({ lastAt }), ME, three, NOW)
    expect(next.batch).toEqual(["b", "c"])
    const onlyOne = settleRecentPeople(
      fresh({ lastAt: NOW - 1.5 * DAY }),
      ME,
      three,
      NOW
    )
    expect(onlyOne.batch).toBeNull()
  })

  it("keeps a batch on show until it is dismissed", () => {
    const state = fresh({ fresh: false, batch: ["a", "b"], lastAt: NOW })
    expect(settleRecentPeople(state, ME, three, NOW)).toBe(state)
  })

  it("another account's record starts from scratch", () => {
    const next = settleRecentPeople(
      { ...fresh(), userId: "someone-else" },
      ME,
      three,
      NOW
    )
    expect(next).toEqual({ ...EMPTY_RECENT_PEOPLE, userId: ME })
  })
})

describe("batchPeople", () => {
  it("lists the batch's connections, newest first, for that user only", () => {
    const list = [friend("a", daysAgo(3)), friend("b", daysAgo(1))]
    const state = fresh({ batch: ["a", "b", "gone"] })
    expect(batchPeople(state, ME, list).map((c) => c.id)).toEqual(["b", "a"])
    expect(batchPeople(state, "other", list)).toEqual([])
    expect(batchPeople(state, null, list)).toEqual([])
  })
})

describe("stored state", () => {
  it("a sign-in arms the card and clears the batch; dismissing hides it", () => {
    window.localStorage.setItem(
      RECENT_PEOPLE_KEY,
      JSON.stringify({ userId: ME, fresh: false, lastAt: 5, batch: ["a"] })
    )
    markFreshSignIn(ME)
    expect(readRecentPeopleState()).toEqual({
      userId: ME,
      fresh: true,
      lastAt: 5,
      batch: null,
    })

    const before = dismissRecentPeople(NOW)
    expect(before.fresh).toBe(true)
    expect(readRecentPeopleState()).toEqual({
      userId: ME,
      fresh: false,
      lastAt: NOW,
      batch: null,
    })
    resetRecentPeopleMemory()
    expect(readRecentPeopleState().lastAt).toBe(NOW)
  })

  it("a different account signing in forgets the last one's marks", () => {
    markFreshSignIn("someone-else")
    dismissRecentPeople(NOW)
    markFreshSignIn(ME)
    expect(readRecentPeopleState()).toEqual(fresh())
  })

  it("survives storage that throws", () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error("blocked")
    }
    try {
      markFreshSignIn(ME)
      expect(readRecentPeopleState().fresh).toBe(true)
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
