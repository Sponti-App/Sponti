// The flare drawer's heights (#615, decided on prototype #617: layout A with
// B's full height). Peek shows the title, time and main action; half is what
// the old map sheet showed; full is everything on the old flare page, but
// stops short of the top so a strip of live map stays in view.

import type { EventItem, HostedEvent } from "@/lib/api/events"

export type DrawerSnap = "peek" | "half" | "full"

/** Peek's own content above the nav: handle, header and the main action. */
export const PEEK_CONTENT_PX = 176
/** The live map kept above the drawer at full. */
export const MAP_STRIP_PX = 150
const HALF_FRACTION = 0.55

/**
 * vaul snap points, as px strings measured from the bottom of the screen
 * (the drawer runs under the bottom nav, so each includes it). Always
 * increasing, even on a short screen.
 */
export function drawerSnapPoints(
  viewportHeight: number,
  navHeight: number
): [string, string, string] {
  const peek = Math.round(navHeight + PEEK_CONTENT_PX)
  const full = Math.max(peek + 2, Math.round(viewportHeight - MAP_STRIP_PX))
  const half = Math.min(
    full - 1,
    Math.max(peek + 1, Math.round(viewportHeight * HALF_FRACTION))
  )
  return [`${peek}px`, `${half}px`, `${full}px`]
}

const SNAPS: DrawerSnap[] = ["peek", "half", "full"]

export function snapIndex(snap: DrawerSnap): number {
  return SNAPS.indexOf(snap)
}

export function snapAt(index: number): DrawerSnap {
  return SNAPS[Math.min(SNAPS.length - 1, Math.max(0, index))]
}

/** How much of the screen a snap point covers, in px. */
export function coverOf(snapPoint: string | number | null): number {
  if (snapPoint === null) return 0
  return typeof snapPoint === "number" ? 0 : parseFloat(snapPoint) || 0
}

export type DrawerOrigin = "map" | "calendar" | "link"

/**
 * The map's pin for a flare loaded only by id (a link): what the map needs to
 * draw it and route to it, from the flare the drawer loaded.
 */
export function pinEventFromHosted(event: HostedEvent): EventItem {
  const name = event.hostName ?? event.hostUsername ?? "host"
  return {
    id: event.id,
    hostId: event.hostId,
    title: event.title,
    type: event.type,
    startAt: event.startAt,
    endAt: event.endAt,
    visibility: event.visibility,
    myRsvp: event.myRsvp ?? null,
    host: {
      id: event.hostId ?? "",
      name,
      username: event.hostUsername,
      avatar: name.charAt(0).toUpperCase(),
      avatarUrl: event.hostAvatarUrl ?? null,
      color: "bg-stone-400",
      note: "",
    },
    location: {
      name: event.locationLabel,
      address: event.locationDetail,
      // GeoJSON order, as the map's own flares carry it.
      coordinates: event.coordinates
        ? [event.coordinates.lng, event.coordinates.lat]
        : undefined,
    },
    attendees: [],
    going: event.attendingCount,
  }
}
