import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Notification } from "@/lib/notifications"

const mocks = vi.hoisted(() => ({
  respondToConnectionRequest: vi.fn(),
  fetchIncomingConnectionRequests: vi.fn(),
  fetchMyCircles: vi.fn(),
  addCircleMember: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock("@/lib/api/connections", () => ({
  respondToConnectionRequest: mocks.respondToConnectionRequest,
  fetchIncomingConnectionRequests: mocks.fetchIncomingConnectionRequests,
}))
vi.mock("@/lib/api/circles", () => ({
  fetchMyCircles: mocks.fetchMyCircles,
  addCircleMember: mocks.addCircleMember,
}))
vi.mock("@/lib/use-events", () => ({ emitEventsChanged: vi.fn() }))
vi.mock("@/lib/use-notifications", () => ({ dismiss: mocks.dismiss }))
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))

import { ActionFeedbackProvider } from "./action-feedback"
import { NotificationRow } from "./notification-row"
import {
  ACCEPT_UNDO_MS,
  resetConnectionRequestActions,
} from "@/lib/connection-request-actions"

const request: Notification = {
  id: "n-req",
  type: "connection_request",
  targetType: "connection",
  targetId: "conn-1",
  title: "maya wants to connect",
  subtitle: "Tap to respond to the request.",
  createdAt: new Date().toISOString(),
  readAt: null,
  read: false,
  href: "/circles?tab=people",
  intent: "connection",
  actorName: "maya",
  actorId: "user-maya",
}

const invite: Notification = {
  ...request,
  id: "n-inv",
  type: "event_invitation",
  targetType: "event",
  targetId: "event-1",
  title: "maya invited you",
  subtitle: "to friday drinks",
  href: "/event",
  intent: "event",
}

function renderRow(notification: Notification, onOpen = vi.fn()) {
  render(
    <ActionFeedbackProvider>
      <ul>
        <NotificationRow notification={notification} onOpen={onOpen} />
      </ul>
    </ActionFeedbackProvider>
  )
  return { onOpen }
}

// Lets the store's resolved promises settle into React state.
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })

function swipe(row: HTMLElement, dx: number) {
  fireEvent.pointerDown(row, { pointerId: 1, clientX: 200, clientY: 50 })
  fireEvent.pointerMove(row, {
    pointerId: 1,
    clientX: 200 + dx / 2,
    clientY: 50,
  })
  fireEvent.pointerMove(row, { pointerId: 1, clientX: 200 + dx, clientY: 50 })
  fireEvent.pointerUp(row, { pointerId: 1, clientX: 200 + dx, clientY: 50 })
}

const rowSurface = (text: string) =>
  screen.getByText(text).closest("li")!.firstElementChild as HTMLElement

describe("NotificationRow", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetConnectionRequestActions()
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 375,
    })
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    mocks.fetchIncomingConnectionRequests.mockResolvedValue([
      { id: "conn-1", user: {}, createdAt: "" },
    ])
    mocks.fetchMyCircles.mockResolvedValue([
      {
        id: "all",
        name: "all friends",
        type: "all",
        memberIds: [],
        description: "",
      },
      {
        id: "close",
        name: "close friends",
        type: "close",
        memberIds: [],
        description: "",
      },
      {
        id: "inner",
        name: "inner circle",
        type: "inner",
        memberIds: ["x"],
        description: "",
      },
    ])
    mocks.respondToConnectionRequest.mockResolvedValue(undefined)
    mocks.addCircleMember.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("a connection request (#174, #226)", () => {
    it("shows accept and decline on the row once it's known to be pending", async () => {
      renderRow(request)
      expect(
        screen.queryByRole("button", { name: "accept" })
      ).not.toBeInTheDocument()

      await flush()

      expect(screen.getByRole("button", { name: "accept" })).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "decline" })
      ).toBeInTheDocument()
    })

    it("stays a plain row when the request was already answered", async () => {
      mocks.fetchIncomingConnectionRequests.mockResolvedValue([])
      renderRow(request)
      await flush()

      expect(
        screen.queryByRole("button", { name: "accept" })
      ).not.toBeInTheDocument()
    })

    it("accept → undo toast and chips, nothing sent → sent after 5s → added to a circle", async () => {
      renderRow(request)
      await flush()

      fireEvent.click(screen.getByRole("button", { name: "accept" }))
      await flush()

      const toast = screen
        .getByText("accepted maya")
        .closest("[role=status]") as HTMLElement
      expect(toast).toBeInTheDocument()
      expect(
        within(toast).getByRole("button", { name: "undo" })
      ).toBeInTheDocument()
      const chips = screen.getByRole("group", { name: "add maya to a circle" })
      expect(
        within(chips)
          .getAllByRole("button")
          .map((b) => b.textContent)
      ).toEqual(["inner circle", "close friends", "skip"])
      expect(mocks.respondToConnectionRequest).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
      })
      expect(mocks.respondToConnectionRequest).toHaveBeenCalledWith(
        "conn-1",
        "accepted"
      )

      fireEvent.click(screen.getByRole("button", { name: "close friends" }))
      await flush()
      expect(mocks.addCircleMember).toHaveBeenCalledWith("close", "user-maya")
      expect(screen.getByText("added to close friends")).toBeInTheDocument()
    })

    it("undo from the toast cancels the accept and brings the buttons back", async () => {
      renderRow(request)
      await flush()

      fireEvent.click(screen.getByRole("button", { name: "accept" }))
      fireEvent.click(screen.getByRole("button", { name: "undo" }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS * 2)
      })

      expect(mocks.respondToConnectionRequest).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "accept" })).toBeInTheDocument()
    })

    it("skip leaves them connected without a circle", async () => {
      renderRow(request)
      await flush()

      fireEvent.click(screen.getByRole("button", { name: "accept" }))
      await flush()
      fireEvent.click(screen.getByRole("button", { name: "skip" }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
      })

      expect(mocks.respondToConnectionRequest).toHaveBeenCalledTimes(1)
      expect(mocks.addCircleMember).not.toHaveBeenCalled()
      expect(screen.getByText("you’re connected")).toBeInTheDocument()
    })

    it("decline is sent straight away and the row updates in place", async () => {
      renderRow(request)
      await flush()

      fireEvent.click(screen.getByRole("button", { name: "decline" }))
      await flush()

      expect(mocks.respondToConnectionRequest).toHaveBeenCalledWith(
        "conn-1",
        "rejected"
      )
      expect(screen.getByText("request declined")).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "accept" })
      ).not.toBeInTheDocument()
    })

    it("swiping right is a shortcut for accept", async () => {
      renderRow(request)
      await flush()

      swipe(rowSurface("maya wants to connect"), 200)
      await flush()

      expect(
        screen.getByRole("group", { name: "add maya to a circle" })
      ).toBeInTheDocument()
      expect(mocks.respondToConnectionRequest).not.toHaveBeenCalled()
    })

    it("swiping left hides it and never declines it (#173)", async () => {
      renderRow(request)
      await flush()

      swipe(rowSurface("maya wants to connect"), -200)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ACCEPT_UNDO_MS)
      })

      expect(mocks.dismiss).toHaveBeenCalledWith("n-req")
      expect(mocks.respondToConnectionRequest).not.toHaveBeenCalled()
    })
  })

  describe("any other row (#173)", () => {
    it("has no answer buttons and still opens on tap", () => {
      const { onOpen } = renderRow(invite)

      expect(
        screen.queryByRole("button", { name: "accept" })
      ).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /maya invited you/ }))
      expect(onOpen).toHaveBeenCalledWith(invite)
    })

    it("swipes left to hide", () => {
      renderRow(invite)
      swipe(rowSurface("maya invited you"), -200)
      expect(mocks.dismiss).toHaveBeenCalledWith("n-inv")
    })

    it("does nothing on a swipe right", () => {
      const { onOpen } = renderRow(invite)
      swipe(rowSurface("maya invited you"), 200)
      expect(mocks.dismiss).not.toHaveBeenCalled()
      expect(onOpen).not.toHaveBeenCalled()
    })

    it("can be hidden from the keyboard too", () => {
      renderRow(invite)
      fireEvent.click(screen.getByRole("button", { name: "hide notification" }))
      expect(mocks.dismiss).toHaveBeenCalledWith("n-inv")
    })
  })
})
