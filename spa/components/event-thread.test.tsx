import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EventThreadList, type EventThreadState } from "./event-thread"

// #559: a thread update's avatar and name open its author's profile.

vi.mock("@/lib/format-date", () => ({ formatRelative: () => "now" }))

const thread = (
  author: EventThreadState["updates"][number]["author"]
): EventThreadState => ({
  updates: [
    {
      _id: "u1",
      eventId: "e1",
      authorId: "a1",
      author,
      body: "bringing snacks",
      createdAt: "2026-06-15T12:00:00.000Z",
      canDelete: false,
    },
  ],
  loading: false,
  error: null,
  closedByServer: false,
  post: async () => true,
  posting: false,
  postError: null,
  remove: () => {},
})

describe("EventThreadList author links (#559)", () => {
  it("links the author's avatar and first name to their profile", () => {
    render(
      <EventThreadList
        thread={thread({
          _id: "a1",
          displayName: "Maya Chen",
          username: "maya",
        })}
        hostId="host"
        viewerId="me"
      />
    )

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/profile/maya")
    }
  })

  it("stays plain when the api sent no username", () => {
    render(
      <EventThreadList
        thread={thread({ _id: "a1", displayName: "Ghost" })}
        hostId="host"
        viewerId="me"
      />
    )

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.getByText("ghost")).toBeInTheDocument()
  })
})
