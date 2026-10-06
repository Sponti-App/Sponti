import { Event, type EventType } from "#models/Event";
import type { PublicMapEventsQuery } from "#schemas/publicSchemas";
import { MAP_SOON_WINDOW_MS } from "#services/eventService";

/** Most pins one signed-out map request returns (same cap as the signed-in map). */
export const PUBLIC_MAP_EVENT_LIMIT = 200;

const EARTH_RADIUS_KM = 6378.1;

/**
 * What a signed-out visitor may learn about an open-to-all flare (#425): that
 * one exists, where, what kind, and when. Nothing else. This is the whole
 * response shape, built field by field from an allowlist, so a field added to
 * the Event model later cannot reach an anonymous caller by accident. A test
 * pins the exact key set. Never add a title, description, host, guest list or
 * count here; those need an account.
 */
export type PublicMapEvent = {
  _id: string;
  type: EventType;
  location: { type: "Point"; coordinates: [number, number] };
  startAt: Date;
  endAt: Date;
};

type PublicMapRow = {
  _id: { toString(): string };
  type: EventType;
  location: { coordinates: number[] };
  startAt: Date;
  endAt: Date;
};

const toPublicMapEvent = (row: PublicMapRow): PublicMapEvent => ({
  _id: row._id.toString(),
  type: row.type,
  location: {
    type: "Point",
    coordinates: [row.location.coordinates[0]!, row.location.coordinates[1]!],
  },
  startAt: row.startAt,
  endAt: row.endAt,
});

/**
 * Flares for the signed-out map. Same window as the signed-in map (live now,
 * or starting within MAP_SOON_WINDOW_MS) but only `visibility: "public"`,
 * `status: "active"` and not ended, and only from hosts that still exist and
 * are not suspended or deleted. There is no viewer, so there are no block,
 * guest-list or membership rules to apply: anyone gets the same answer.
 *
 * Users have no suspended or deleted state yet, so `suspendedAt` and
 * `deletedAt` are the names that check reads; an account is also excluded when
 * its user document is gone. Soonest first, capped at PUBLIC_MAP_EVENT_LIMIT.
 */
export const getPublicMapEvents = async (query: PublicMapEventsQuery) => {
  const now = new Date();

  const rows = await Event.aggregate<PublicMapRow>([
    {
      $match: {
        visibility: "public",
        status: "active",
        endAt: { $gt: now },
        startAt: { $lte: new Date(now.getTime() + MAP_SOON_WINDOW_MS) },
        location: {
          $geoWithin: {
            $centerSphere: [[query.lng, query.lat], query.radiusKm / EARTH_RADIUS_KM],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        let: { hostId: "$hostId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$hostId"] },
              suspendedAt: null,
              deletedAt: null,
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "activeHost",
      },
    },
    { $match: { "activeHost.0": { $exists: true } } },
    { $sort: { startAt: 1, _id: 1 } },
    { $limit: PUBLIC_MAP_EVENT_LIMIT },
    { $project: { type: 1, startAt: 1, endAt: 1, "location.coordinates": 1 } },
  ]);

  return rows.map(toPublicMapEvent);
};
