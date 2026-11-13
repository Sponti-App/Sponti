import { act, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Notification } from "@/lib/notifications"

const mocks = vi.hoisted(() => ({
  listener: null as null | ((batch: Notification[]) => void),
  unread: 0,
  haptic: vi.fn(),
  reduced: false,
}))

vi.mock("@/lib/use-notifications", () => ({
  subscribeToNotificationArrivals: (l: (b: Notification[]) => void) => {
    mocks.listener = l
    return () => {
      mocks.listener = null
    }
  },
  unreadCountNow: () => mocks.unread,
}))
vi.mock("@/lib/haptics", () => ({ haptic: mocks.haptic }))
vi.mock("@/lib/motion/reduced-motion", () => ({
  useReducedMotion: () => mocks.reduced,
}))

import { JoinMoment } from "./join-moment"
import { useJoinBell } from "@/lib/join-bell"
import {
  BELL_SWING_MS,
  JOIN_END,
  JOIN_END_REDUCED,
  JOIN_IMPACT,
} from "@/lib/motion/join"

const join = (id: string, actor: string, firstJoin = false): Notification => ({
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
  actorName: actor,
  actorId: actor,
  rsvp: {
    change: "joined",
    status: "going",
    firstJoin,
    eventTitle: "sunset swim",
    willArriveAt: null,
    arrivalStatus: null,
  },
})

const arrive = (batch: Notification[]) => act(() => mocks.listener?.(batch))
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const overlay = () => document.querySelector("[data-join-moment]")

describe("JoinMoment", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    })
    mocks.haptic.mockClear()
    mocks.reduced = false
    mocks.unread = 0
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("plays the first join once, holding the badge until it lands", () => {
    render(<JoinMoment />)
    const bell = renderHook(() => useJoinBell())
    arrive([join("n1", "mia", true)])

    expect(screen.getByRole("status")).toHaveTextContent(
      "mia joined your flare"
    )
    expect(bell.result.current.heldUnread).toBe(0)

    advance(JOIN_IMPACT + 20)
    expect(mocks.haptic).toHaveBeenCalledWith("success")
    expect(bell.result.current).toMatchObject({
      heldUnread: null,
      cue: { kind: "swing" },
    })
    advance(JOIN_END)
    expect(overlay()).toBeNull()

    // A second join only swings the bell.
    arrive([join("n2", "jonas")])
    expect(overlay()).toBeNull()
    expect(mocks.haptic).toHaveBeenLastCalledWith("light")
    expect(bell.result.current.cue?.kind).toBe("swing")
  })

  it("stacks joins from one poll into one overlay", () => {
    render(<JoinMoment />)
    arrive([join("n1", "mia", true), join("n2", "jonas")])
    expect(screen.getByRole("status")).toHaveTextContent(
      "mia and jonas joined your flare"
    )
  })

  it("queues joins from separate polls, never overlapping", () => {
    render(<JoinMoment />)
    arrive([join("n1", "mia", true)])
    arrive([join("n2", "leo", true)])
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent("mia joined")

    advance(JOIN_END + 50)
    expect(screen.getByRole("status")).toHaveTextContent("leo joined")
    advance(JOIN_END + 50)
    expect(overlay()).toBeNull()

    // A later join queued behind a first one waits its turn too.
    arrive([join("n3", "ava", true)])
    arrive([join("n4", "ben")])
    expect(mocks.haptic).not.toHaveBeenCalledWith("light")
    advance(JOIN_END + 50)
    expect(mocks.haptic).toHaveBeenCalledWith("light")
    advance(BELL_SWING_MS)
  })

  it("with reduced motion, fades in place and lights the bell", () => {
    mocks.reduced = true
    render(<JoinMoment />)
    const bell = renderHook(() => useJoinBell())
    arrive([join("n1", "mia", true)])
    expect(overlay()).toHaveAttribute("data-join-moment", "reduced")
    advance(JOIN_IMPACT + 20)
    expect(bell.result.current.cue?.kind).toBe("highlight")
    advance(JOIN_END_REDUCED)
    expect(overlay()).toBeNull()
  })

  it("ignores a leave", () => {
    render(<JoinMoment />)
    const bell = renderHook(() => useJoinBell())
    const leave = join("n1", "mia")
    arrive([
      {
        ...leave,
        rsvp: { ...leave.rsvp!, change: "declined", status: "declined" },
      },
    ])
    expect(overlay()).toBeNull()
    expect(bell.result.current).toEqual({ heldUnread: null, cue: null })
    expect(mocks.haptic).not.toHaveBeenCalled()
  })
})
