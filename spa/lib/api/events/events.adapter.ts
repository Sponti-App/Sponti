import type { DraftEvent } from "@/lib/draft-events"
import type { EventItem, EventType } from "@/lib/events"
import type {
  ApiEvent,
  CreateEventRequest,
  EventGuestInviteMode,
} from "./events.types"

const MIN = 60_000

// TODO: Once google map API is added, use real location data
export const TEMP_EVENT_LOCATION_FALLBACK = {
  locationName: "Hamburg",
  locationAddress: "Hamburg, Germany",
  location: {
    type: "Point" as const,
    coordinates: [9.9937, 53.5511] as [number, number],
  },
}

export type EventAudienceTarget =
  | { kind: "public" }
  | { kind: "circle"; circleId: string }
  | { kind: "members"; memberIds: string[] }

type EventTimeRange = {
  startAt: string
  endAt: string
}

const TYPE_KEYWORDS: Array<{ test: RegExp; type: EventType }> = [
  {
    test: /coffee|latte|espresso|brunch|breakfast|food|dinner|lunch/i,
    type: "coffee",
  },
  { test: /run|jog|hike|cycle|ride|sports|gym/i, type: "run" },
]

function inferType(title: string): EventType {
  for (const { test, type } of TYPE_KEYWORDS) if (test.test(title)) return type
  return "hang"
}

function hostFromApi(host: ApiEvent["hostId"]): EventItem["host"] {
  if (typeof host === "string") {
    return { name: "host", avatar: "?", color: "bg-stone-400", note: "" }
  }
  const name = host.displayName || host.username || "host"
  return {
    name,
    avatar: name.charAt(0).toUpperCase(),
    color: "bg-stone-400",
    note: "",
  }
}

export function adaptApiEvent(api: ApiEvent): EventItem {
  return {
    id: api._id,
    title: api.title,
    type: inferType(api.title),
    startAt: api.startAt,
    endAt: api.endAt,
    visibility: api.visibility,
    myRsvp: api.myRsvp ?? null,
    host: hostFromApi(api.hostId),
    location: {
      name: api.locationName,
      address: api.locationAddress ?? undefined,
      coordinates: api.location?.coordinates,
    },
    attendees: (api.attendees ?? []).map((a) => {
      const name = a.displayName || a.username || "guest"
      return {
        name,
        avatar: name.charAt(0).toUpperCase(),
        color: "bg-stone-300",
      }
    }),
    going: api.goingCount ?? api.attendees?.length ?? 0,
  }
}

export function guestInviteModeFromDraft(
  draft: DraftEvent
): EventGuestInviteMode {
  if (draft.visibility === "public") return "none"
  if (draft.allowForward) return "multiple"
  if (draft.allowPlusOne) return "single"
  return "none"
}

function locationFromDraft(
  draft: DraftEvent
): Pick<CreateEventRequest, "locationName" | "locationAddress" | "location"> {
  if (draft.whereType === "search" && draft.customWhere?.trim()) {
    return {
      ...TEMP_EVENT_LOCATION_FALLBACK,
      locationName: draft.customWhere.trim(),
      locationAddress: TEMP_EVENT_LOCATION_FALLBACK.locationAddress,
    }
  }

  if (draft.whereType === "saved" && draft.savedPlaceLabel?.trim()) {
    return {
      ...TEMP_EVENT_LOCATION_FALLBACK,
      locationName: draft.savedPlaceLabel.trim(),
      locationAddress: TEMP_EVENT_LOCATION_FALLBACK.locationAddress,
    }
  }

  return TEMP_EVENT_LOCATION_FALLBACK
}

export function timeRangeFromDraft(draft: DraftEvent): EventTimeRange {
  let startMs: number

  if (draft.mode === "now") {
    startMs =
      new Date(draft.createdAt).getTime() +
      (draft.startOffsetMinutes ?? 0) * MIN
  } else if (draft.startDate && draft.startTime) {
    startMs = new Date(`${draft.startDate}T${draft.startTime}`).getTime()
  } else {
    startMs = new Date(draft.createdAt).getTime()
  }

  const endMs = startMs + draft.durationMinutes * MIN
  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
  }
}

export function createEventRequestFromDraft(
  draft: DraftEvent,
  audience: EventAudienceTarget,
  timeRange: EventTimeRange = timeRangeFromDraft(draft)
): CreateEventRequest {
  const isPublic = draft.visibility === "public"
  const target = isPublic ? { kind: "public" as const } : audience

  return {
    title: draft.title.trim() || draft.eventType,
    description: draft.details?.trim() ? draft.details.trim() : null,
    startAt: timeRange.startAt,
    endAt: timeRange.endAt,
    ...locationFromDraft(draft),
    visibility: draft.visibility,
    allowGuestInvites: guestInviteModeFromDraft(draft),
    guestInviteLimit: draft.guestLimit ?? 0,
    circles:
      target.kind === "circle"
        ? [{ circleId: target.circleId, role: "guest" }]
        : [],
    members:
      target.kind === "members"
        ? target.memberIds.map((userId) => ({ userId, role: "guest" }))
        : [],
  }
}

export function etaToIso(eta: string | null): string | null {
  if (!eta) return null
  const trimmed = eta.trim().toLowerCase()
  const match = /^(\d+)\s*(min|hr|hour|hours|h)$/.exec(trimmed)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2]
  const minutes = unit === "min" ? value : value * 60
  return new Date(Date.now() + minutes * MIN).toISOString()
}
