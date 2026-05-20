import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EventHostCard } from "@/components/event-host-card"
import type { HostedEvent } from "@/lib/api/events"

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: {
      id: "viewer-1",
      username: "martin",
      displayName: "Martin",
      email: "martin@example.com",
      profileVisibility: "private",
      socialBattery: 80,
      createdAt: "2026-05-19T10:00:00.000Z",
      updatedAt: "2026-05-19T10:00:00.000Z",
    },
  }),
}))

const invitedEvent: HostedEvent = {
  id: "event-1",
  hostId: "host-1",
  hostName: "Alex Kim",
  hostUsername: "alex",
  title: "Park walk before lunch",
  description: "Meet by the south gate.",
  type: "hangout",
  startAt: "2026-05-20T10:00:00.000Z",
  endAt: "2026-05-20T12:00:00.000Z",
  locationLabel: "Tantolunden",
  locationDetail: "south gate",
  audienceLabel: "private",
  attendeeCount: 4,
  attendingCount: 2,
  guestLimit: 4,
  visibility: "private",
  recurrence: "none",
  apiStatus: "active",
  updatedAt: "2026-05-19T10:00:00.000Z",
}

describe("EventHostCard", () => {
  it("renders invited flares with backend host identity and guest routing", () => {
    render(
      <EventHostCard
        event={invitedEvent}
        status="upcoming"
        canManage={false}
      />
    )

    expect(
      screen.getByRole("link", {
        name: /open details for Park walk before lunch/i,
      })
    ).toHaveAttribute("href", "/event/event-1")
    expect(screen.getByText("alex kim")).toBeInTheDocument()
    expect(screen.getByLabelText("private")).toBeInTheDocument()
    expect(screen.queryByText("private")).not.toBeInTheDocument()
    expect(screen.queryByText("hangout")).not.toBeInTheDocument()
  })
})
