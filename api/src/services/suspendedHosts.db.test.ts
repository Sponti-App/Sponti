import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Event } from "#models/index";
import { buildAccessibleEventFilter } from "#services/eventService";
import { getInactiveUserIds } from "#services/userDirectoryService";

// #542: an account stopped by hand (suspendedAt or deletedAt on its user
// document, deploy/netcup/MODERATION.md) hosts nothing a signed-in user sees,
// as on the signed-out map. Against an in-memory Mongo, so the null and
// missing-field cases are the real query's.

const VIEWER = new Types.ObjectId();
const ACTIVE = new Types.ObjectId();
const NULLED = new Types.ObjectId();
const SUSPENDED = new Types.ObjectId();
const DELETED = new Types.ObjectId();

let mongoServer: MongoMemoryReplSet;

const users = () => mongoose.connection.db!.collection("users");

const publicFlare = (hostId: Types.ObjectId) =>
  Event.create({
    hostId,
    title: "picnic",
    type: "hangout",
    startAt: new Date(Date.now() - 10 * 60_000),
    endAt: new Date(Date.now() + 60 * 60_000),
    locationName: "park",
    location: { type: "Point", coordinates: [13.38, 52.55] },
    visibility: "public",
    status: "active",
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_suspended_test" });
}, 120_000);

afterEach(async () => {
  await Promise.all([Event.deleteMany({}), users().deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const seedUsers = () =>
  users().insertMany([
    { _id: VIEWER, username: "viewer" },
    { _id: ACTIVE, username: "active" },
    { _id: NULLED, username: "nulled", suspendedAt: null, deletedAt: null },
    { _id: SUSPENDED, username: "suspended", suspendedAt: new Date() },
    { _id: DELETED, username: "deleted", deletedAt: new Date() },
  ]);

describe("getInactiveUserIds", () => {
  it("lists suspended and deleted accounts, not missing or null fields", async () => {
    await seedUsers();

    const ids = await getInactiveUserIds();

    expect(ids.sort()).toEqual([SUSPENDED.toString(), DELETED.toString()].sort());
  });
});

describe("buildAccessibleEventFilter", () => {
  it("hides an open-to-all flare whose host is suspended or deleted", async () => {
    await seedUsers();
    await Promise.all([ACTIVE, NULLED, SUSPENDED, DELETED].map(publicFlare));

    const filter = await buildAccessibleEventFilter(VIEWER.toString());
    const visible = await Event.find(filter).select("hostId").lean();

    expect(visible.map((e) => String(e.hostId)).sort()).toEqual(
      [ACTIVE.toString(), NULLED.toString()].sort()
    );
  });
});
