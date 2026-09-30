import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HttpError } from "@/lib/http"

const mocks = vi.hoisted(() => ({
  respondToConnectionRequest: vi.fn(),
  fetchIncomingConnectionRequests: vi.fn(),
  fetchMyCircles: vi.fn(),
  addCircleMember: vi.fn(),
  emitEventsChanged: vi.fn(),
}))

vi.mock("@/lib/api/connections", () => ({
  respondToConnectionRequest: mocks.respondToConnectionRequest,
  fetchIncomingConnectionRequests: mocks.fetchIncomingConnectionRequests,
}))
vi.mock("@/lib/api/circles", () => ({
  fetchMyCircles: mocks.fetchMyCircles,
  addCircleMember: mocks.addCircleMember,
}))
vi.mock("@/lib/use-events", () => ({
  emitEventsChanged: mocks.emitEventsChanged,
}))

import {
  ACCEPT_UNDO_MS,
  declineRequest,
  ensurePendingRequests,
  pickCircle,
  resetConnectionRequestActions,
  scheduleAccept,
  skipCircle,
  undoAccept,
  useConnectionRequest,
} from "./connection-request-actions"

const CONN = "conn-1"
const close = { id: "close", name: "close friends" }

function view() {
  return renderHook(() => useConnectionRequest(CONN))
}

describe("connection request actions (#174, #226)", () => {
  let notify: ReturnType<
    typeof vi.fn<(message: string, tone: "success" | "error") => void>
  >

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetConnectionRequestActions()
    notify = vi.fn()
    mocks.respondToConnectionRequest.mockResolvedValue(undefined)
    mocks.addCircleMember.mockResolvedValue(undefined)
    mocks.fetchMyCircles.mockResolvedValue([])
    mocks.fetchIncomingConnectionRequests.mockResolvedValue([
      { id: CONN, user: {}, createdAt: "" },
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("knows which requests are still pending", async () => {
    const { result } = view()
    expect(result.current.pending).toBe("unknown")

    await act(async () => {
      ensurePendingRequests()
    })

    expect(result.current.pending).toBe("yes")
    expect(
      renderHook(() => useConnectionRequest("other")).result.current.pending
    ).toBe("no")
  })

  it("offers the buttons anyway if the pending check fails", async () => {
    mocks.fetchIncomingConnectionRequests.mockRejectedValue(new Error("down"))
    const { result } = view()

    await act(async () => {
      ensurePendingRequests()
    })

    expect(result.current.pending).toBe("yes")
  })

  it("sends nothing during the undo window, then accepts", async () => {
    const { result } = view()

    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    expect(result.current.phase).toBe("undo")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS - 1)
    })
    expect(mocks.respondToConnectionRequest).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(mocks.respondToConnectionRequest).toHaveBeenCalledWith(
      CONN,
      "accepted"
    )
    expect(result.current.phase).toBe("accepted")
    expect(mocks.emitEventsChanged).toHaveBeenCalled()
  })

  it("undo cancels the api call entirely", async () => {
    const { result } = view()

    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    act(() => undoAccept(CONN))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS * 2)
    })

    expect(mocks.respondToConnectionRequest).not.toHaveBeenCalled()
    expect(result.current.phase).toBe("idle")
  })

  it("still accepts when the row unmounts mid-window (sheet closed)", async () => {
    const { unmount } = view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
    })

    expect(mocks.respondToConnectionRequest).toHaveBeenCalledWith(
      CONN,
      "accepted"
    )
  })

  it("sends a waiting accept right away when the page is hidden", async () => {
    view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
    })

    expect(mocks.respondToConnectionRequest).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
    })
    expect(mocks.respondToConnectionRequest).toHaveBeenCalledTimes(1)
  })

  it("queues a circle picked during the window and adds it after the accept", async () => {
    const { result } = view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))

    act(() => pickCircle(CONN, close))
    expect(result.current.placement).toEqual({
      status: "queued",
      circle: close,
    })
    expect(mocks.addCircleMember).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
    })

    expect(mocks.addCircleMember).toHaveBeenCalledWith("close", "maya")
    expect(result.current.placement).toEqual({ status: "added", circle: close })
  })

  it("undo also drops a queued circle", async () => {
    view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    act(() => pickCircle(CONN, close))
    act(() => undoAccept(CONN))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
    })

    expect(mocks.addCircleMember).not.toHaveBeenCalled()
  })

  it("adds straight away once accepted, and puts the chips back on failure", async () => {
    mocks.addCircleMember.mockRejectedValueOnce(new Error("nope"))
    const { result } = view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
    })

    await act(async () => {
      pickCircle(CONN, close)
    })
    expect(result.current.placement).toEqual({ status: "none" })
    expect(notify).toHaveBeenCalledWith("couldn't add to circle", "error")

    await act(async () => {
      pickCircle(CONN, close)
    })
    expect(result.current.placement).toEqual({ status: "added", circle: close })
  })

  it("skip records no circle", () => {
    const { result } = view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    act(() => skipCircle(CONN))
    expect(result.current.placement).toEqual({ status: "skipped" })
  })

  it("brings the buttons back and says so if the accept fails", async () => {
    mocks.respondToConnectionRequest.mockRejectedValue(new Error("down"))
    const { result } = view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
    })

    expect(result.current.phase).toBe("idle")
    expect(notify).toHaveBeenCalledWith("couldn't accept, try again", "error")
  })

  it("marks a request answered elsewhere as handled", async () => {
    mocks.respondToConnectionRequest.mockRejectedValue(
      new HttpError(404, "Connection request not found")
    )
    const { result } = view()
    act(() => scheduleAccept(CONN, { userId: "maya", notify }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
    })

    expect(result.current.phase).toBe("handled")
  })

  it("declines only through declineRequest, straight away", async () => {
    const { result } = view()

    await act(async () => {
      await declineRequest(CONN, notify)
    })

    expect(mocks.respondToConnectionRequest).toHaveBeenCalledWith(
      CONN,
      "rejected"
    )
    expect(result.current.phase).toBe("declined")
  })
})
