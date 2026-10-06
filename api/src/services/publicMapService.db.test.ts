import type { Express } from "express";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Event, EventMember } from "#models/index";
import type { EventDocument } from "#models/Event";
import { PUBLIC_MAP_EVENT_LIMIT } from "#services/publicMapService";

// #425: the signed-out map. GET /api/v1/public/events/map has no token and no
// viewer, so everything it returns is readable by anyone on the internet. These
// tests pin two things: which flares appear, and that each one carries exactly
// the allowed keys and nothing else (so a field added to the Event model later
// can't leak by accident, the way profileFieldsNeverLeak.db.test.ts does for
// profiles).

const ALLOWED_KEYS = ["_id", "endAt", "location", "startAt", "type"];
const ALLOWED_LOCATION_KEYS = ["coordinates", "type"];

// Berlin Mitte, and a point in Munich well outside any Berlin radius.
const BERLIN = { lng: 13.405, lat: 52.52 };
const MUNICH = { lng: 11.582, lat: 48.1351 };

const MARKERS = {
  title: "title-marker-secret",
  description: "description-marker-secret",
  locationName: "location-name-marker-secret",
  locationAddress: "location-address-marker-secret",
};

const HOST_ID = new Types.ObjectId();
const GUEST_ID = new Types.ObjectId();
const SUSPENDED_HOST_ID = new Types.ObjectId();
const DELETED_HOST_ID = new Types.ObjectId();
const MISSING_HOST_ID = new Types.ObjectId();

let mongoServer: MongoMemoryReplSet;
let app: Express;

const users = () => mongoose.connection.db!.collection("users");
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

const makeEvent = (overrides: Record<string, unknown> = {}): EventDocument => {
  const { at = BERLIN, ...rest } = overrides as { at?: typeof BERLIN } & Record<string, unknown>;
  return {
    hostId: HOST_ID,
    title: MARKERS.title,
    description: MARKERS.description,
    type: "drinks",
    startAt: inMinutes(-30),
    endAt: inMinutes(90),
    locationName: MARKERS.locationName,
    locationAddress: MARKERS.locationAddress,
    location: { type: "Point", coordinates: [at.lng, at.lat] },
    visibility: "public",
    status: "active",
    ...rest,
  } as EventDocument;
};

const getMap = (query = `lng=${BERLIN.lng}&lat=${BERLIN.lat}&radiusKm=25`) =>
  request(app).get(`/api/v1/public/events/map?${query}`);

const idsOf = (body: { data: Array<{ _id: string }> }) => body.data.map((event) => event._id);

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = "mongodb://localhost:27017";
  process.env.DB_NAME = "sponti_api_test";
  process.env.CLIENT_BASE_URL = "http://localhost:3000/";
  process.env.ACCESS_JWT_SECRET = "test-secret";
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_public_map_test" });
  await Event.syncIndexes();

  const module = await import("#app");
  app = module.createApp();
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

beforeEach(async () => {
  await Promise.all([Event.deleteMany({}), EventMember.deleteMany({}), users().deleteMany({})]);
  await users().insertMany([
    { _id: HOST_ID, username: "host", displayName: "host", email: "host@example.com" },
    { _id: GUEST_ID, username: "guest", displayName: "guest", email: "guest@example.com" },
    {
      _id: SUSPENDED_HOST_ID,
      username: "suspended",
      displayName: "suspended",
      email: "suspended@example.com",
      suspendedAt: new Date(),
    },
    {
      _id: DELETED_HOST_ID,
      username: "deleted",
      displayName: "deleted",
      email: "deleted@example.com",
      deletedAt: new Date(),
    },
  ]);
});

describe("GET /public/events/map (#425)", () => {
  it("needs no token", async () => {
    const live = await Event.create(makeEvent());

    const response = await getMap().expect(200);

    expect(idsOf(response.body)).toEqual([live.id]);
  });

  it("returns exactly the allowed keys and no flare details", async () => {
    // A member row exists, so a leak of guests or counts would have data to leak.
    const live = await Event.create(makeEvent());
    await EventMember.create({
      eventId: live._id,
      userId: GUEST_ID,
      invitedBy: HOST_ID,
      role: "guest",
      rsvpStatus: "going",
    });

    const response = await getMap().expect(200);

    expect(response.body.data).toHaveLength(1);
    const [flare] = response.body.data;
    expect(Object.keys(flare).sort()).toEqual(ALLOWED_KEYS);
    expect(Object.keys(flare.location).sort()).toEqual(ALLOWED_LOCATION_KEYS);
    expect(flare).toEqual({
      _id: live.id,
      type: "drinks",
      location: { type: "Point", coordinates: [BERLIN.lng, BERLIN.lat] },
      startAt: live.startAt.toISOString(),
      endAt: live.endAt.toISOString(),
    });

    // Belt and braces: none of the private values appear anywhere in the body.
    const raw = JSON.stringify(response.body);
    for (const marker of Object.values(MARKERS)) {
      expect(raw).not.toContain(marker);
    }
    for (const id of [HOST_ID, GUEST_ID]) {
      expect(raw).not.toContain(id.toString());
    }
    expect(response.body).toEqual({ data: expect.any(Array) });
  });

  it("returns the response as a list under data and is not cacheable", async () => {
    const response = await getMap().expect(200);

    expect(response.body).toEqual({ data: [] });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("excludes private, cancelled, completed and ended flares", async () => {
    const live = await Event.create(makeEvent());
    await Event.create([
      makeEvent({ visibility: "private" }),
      makeEvent({ status: "cancelled" }),
      makeEvent({ status: "completed" }),
      makeEvent({ startAt: inMinutes(-180), endAt: inMinutes(-10) }),
    ]);

    const response = await getMap().expect(200);

    expect(idsOf(response.body)).toEqual([live.id]);
  });

  it("excludes private flares even when the host invited guests", async () => {
    const privateFlare = await Event.create(makeEvent({ visibility: "private" }));
    await EventMember.create({
      eventId: privateFlare._id,
      userId: GUEST_ID,
      invitedBy: HOST_ID,
      role: "guest",
      rsvpStatus: "going",
    });

    const response = await getMap().expect(200);

    expect(response.body.data).toEqual([]);
  });

  it("keeps the live-or-soon window of the signed-in map", async () => {
    const soon = await Event.create(makeEvent({ startAt: inMinutes(60), endAt: inMinutes(180) }));
    await Event.create(
      makeEvent({ startAt: inMinutes(60 * 30), endAt: inMinutes(60 * 31) }) // 30 hours out
    );

    const response = await getMap().expect(200);

    expect(idsOf(response.body)).toEqual([soon.id]);
  });

  it("excludes out-of-bounds flares", async () => {
    const berlin = await Event.create(makeEvent());
    const munich = await Event.create(makeEvent({ at: MUNICH }));

    const berlinMap = await getMap().expect(200);
    const munichMap = await getMap(`lng=${MUNICH.lng}&lat=${MUNICH.lat}&radiusKm=25`).expect(200);

    expect(idsOf(berlinMap.body)).toEqual([berlin.id]);
    expect(idsOf(munichMap.body)).toEqual([munich.id]);
  });

  it("excludes flares from suspended, deleted and missing hosts", async () => {
    const live = await Event.create(makeEvent());
    await Event.create([
      makeEvent({ hostId: SUSPENDED_HOST_ID }),
      makeEvent({ hostId: DELETED_HOST_ID }),
      makeEvent({ hostId: MISSING_HOST_ID }),
    ]);

    const response = await getMap().expect(200);

    expect(idsOf(response.body)).toEqual([live.id]);
  });

  it("returns the soonest flares first and caps the result", async () => {
    const later = await Event.create(makeEvent({ startAt: inMinutes(120), endAt: inMinutes(240) }));
    const earlier = await Event.create(makeEvent({ startAt: inMinutes(-60) }));

    const response = await getMap().expect(200);
    expect(idsOf(response.body)).toEqual([earlier.id, later.id]);

    await Event.insertMany(Array.from({ length: PUBLIC_MAP_EVENT_LIMIT + 5 }, () => makeEvent()));
    const capped = await getMap().expect(200);
    expect(capped.body.data).toHaveLength(PUBLIC_MAP_EVENT_LIMIT);
  });

  it("validates the query", async () => {
    await getMap("").expect(400);
    await getMap("lng=13.4&lat=95").expect(400);
    await getMap("lng=13.4&lat=52.5&radiusKm=500").expect(400);
    await getMap("lng=13.4&lat=52.5&radiusKm=0").expect(400);
    await getMap("lng=13.4&lat=52.5&extra=1").expect(400);

    const response = await getMap("lng=13.4&lat=52.5").expect(200);
    expect(response.body).toEqual({ data: [] });
  });

  it("leaves the signed-in events endpoints behind auth", async () => {
    await Event.create(makeEvent());

    for (const path of [
      "/api/v1/events",
      "/api/v1/events/map/active?lng=13.4&lat=52.5",
      "/api/v1/events/calendar/upcoming",
      "/api/v1/events/public-map",
      `/api/v1/events/${new Types.ObjectId().toString()}`,
      "/api/v1/public/unknown",
    ]) {
      const response = await request(app).get(path).expect(401);
      expect(response.body.error.code, path).toBe("ACCESS_TOKEN_MISSING");
    }
  });

  // Keep this last: the limiter counts per address for the whole test file.
  it("is rate-limited", async () => {
    let limited: request.Response | undefined;

    for (let i = 0; i < 70 && !limited; i += 1) {
      const response = await getMap();
      if (response.status === 429) limited = response;
    }

    expect(limited?.body.error.code).toBe("RATE_LIMITED");
    expect(limited?.headers["retry-after"]).toBeDefined();
  });
});
