import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { backfillLiveUntil, MAX_FLARE_DURATION_MS } from "#models/Event";
import { Event, EventMember } from "#models/index";
import { createEventBodySchema } from "#schemas/eventSchemas";
import {
  createEvent,
  getActiveMapEvents,
  getMyUpcomingEvents,
  updateEvent,
} from "#services/eventService";

// #614: a flare with no end (`endAt: null`) is live until 12h after its start.
// Every "is it over yet" filter reads the derived `liveUntil`, so these pin
// that it is set on create and edit, that the map and "my flares" follow it,
// and that flares saved before it existed get it at start-up.

const HOST_ID = new Types.ObjectId().toString();
const BERLIN = { lng: 13.405, lat: 52.52 };
const HOUR = 60 * 60 * 1000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR);

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_open_end_test" });
  await Promise.all([Event.syncIndexes(), EventMember.syncIndexes()]);
}, 120_000);

afterEach(async () => {
  await Promise.all([Event.deleteMany({}), EventMember.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const body = (startAt: Date, endAt: Date | null) =>
  createEventBodySchema.parse({
    title: "drinks",
    type: "drinks",
    startAt: startAt.toISOString(),
    endAt: endAt?.toISOString() ?? null,
    locationName: "the annex",
    location: { type: "Point", coordinates: [BERLIN.lng, BERLIN.lat] },
    visibility: "private",
  });

const lightFlare = async (startAt: Date, endAt: Date | null) => {
  const { event } = await createEvent(HOST_ID, body(startAt, endAt));
  return String(event._id);
};

const onMap = async (id: string) => {
  const events = await getActiveMapEvents(HOST_ID, { ...BERLIN, radiusKm: 10 });
  return events.some((event) => String((event as { _id: unknown })._id) === id);
};

describe("an open end (#614)", () => {
  it("is stored as no end, live until 12 hours after the start", async () => {
    const startAt = hoursFromNow(-1);
    const id = await lightFlare(startAt, null);

    const stored = await Event.findById(id).lean();
    expect(stored?.endAt).toBeNull();
    expect(stored?.liveUntil?.getTime()).toBe(startAt.getTime() + MAX_FLARE_DURATION_MS);
    expect(await onMap(id)).toBe(true);
  });

  it("is over 12 hours after the start: off the map, and in the host's past flares", async () => {
    const id = await lightFlare(hoursFromNow(-13), null);

    expect(await onMap(id)).toBe(false);
    const mine = await getMyUpcomingEvents(HOST_ID, {});
    const ids = (list: unknown[]) => list.map((event) => String((event as { _id: unknown })._id));
    expect(ids(mine.hostedByMe)).not.toContain(id);
    expect(ids(mine.pastHosted)).toContain(id);
  });

  it("can be ended now by setting the end, and opened up again by clearing it", async () => {
    const id = await lightFlare(hoursFromNow(-1), null);

    await updateEvent(HOST_ID, id, { endAt: new Date(Date.now() - 1000) });
    expect(await onMap(id)).toBe(false);

    await updateEvent(HOST_ID, id, { endAt: null });
    const reopened = await Event.findById(id).lean();
    expect(reopened?.endAt).toBeNull();
    expect(await onMap(id)).toBe(true);
  });
});

describe("a set end (#614)", () => {
  it("keeps liveUntil on the end, and follows an edited end", async () => {
    const startAt = hoursFromNow(1);
    const id = await lightFlare(startAt, hoursFromNow(3));

    const later = hoursFromNow(10);
    await updateEvent(HOST_ID, id, { endAt: later });

    const stored = await Event.findById(id).lean();
    expect(stored?.liveUntil?.getTime()).toBe(later.getTime());
  });

  it("can be up to 12 hours after the start, and no more", async () => {
    const startAt = hoursFromNow(1);
    expect(() => body(startAt, new Date(startAt.getTime() + 12 * HOUR))).not.toThrow();
    expect(() => body(startAt, new Date(startAt.getTime() + 12 * HOUR + 60_000))).toThrow(
      /at most 12 hours/
    );

    const id = await lightFlare(startAt, hoursFromNow(3));
    await expect(
      updateEvent(HOST_ID, id, { endAt: new Date(startAt.getTime() + 13 * HOUR) })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_EVENT_TIME_RANGE" });
  });
});

describe("flares saved before liveUntil existed (#614)", () => {
  it("get it once at start-up, from their end or the 12 hour cap", async () => {
    const startAt = hoursFromNow(-2);
    const endAt = hoursFromNow(2);
    const raw = mongoose.connection.db!.collection("events");
    const base = {
      hostId: new Types.ObjectId(HOST_ID),
      title: "old",
      type: "drinks",
      startAt,
      locationName: "the annex",
      location: { type: "Point", coordinates: [BERLIN.lng, BERLIN.lat] },
      visibility: "private",
      allowGuestInvites: "none",
      guestInviteLimit: 0,
      status: "active",
    };
    const { insertedIds } = await raw.insertMany([
      { ...base, endAt },
      { ...base, endAt: null },
    ]);

    expect(await backfillLiveUntil()).toBe(2);
    const [withEnd, open] = await Promise.all([
      Event.findById(insertedIds[0]).lean(),
      Event.findById(insertedIds[1]).lean(),
    ]);
    expect(withEnd?.liveUntil?.getTime()).toBe(endAt.getTime());
    expect(open?.liveUntil?.getTime()).toBe(startAt.getTime() + MAX_FLARE_DURATION_MS);

    // Nothing left to do the second time.
    expect(await backfillLiveUntil()).toBe(0);
  });
});
