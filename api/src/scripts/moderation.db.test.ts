import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Event } from "#models/index";
import { buildAccessibleEventFilter } from "#services/eventService";
import { hideFlare, suspendUser, unsuspendUser } from "./moderation.js";

// The hand-moderation commands (#542) against an in-memory Mongo: dry runs
// change nothing, --apply does what deploy/netcup/MODERATION.md says.

const HOST = new Types.ObjectId();
const VIEWER = new Types.ObjectId();

let mongoServer: MongoMemoryReplSet;

const db = () => mongoose.connection.db!;

const publicFlare = () =>
  Event.create({
    hostId: HOST,
    title: "picnic",
    type: "hangout",
    startAt: new Date(Date.now() - 10 * 60_000),
    endAt: new Date(Date.now() + 60 * 60_000),
    locationName: "park",
    location: { type: "Point", coordinates: [13.38, 52.55] },
    visibility: "public",
    status: "active",
  });

const visibleTo = async (userId: Types.ObjectId) =>
  Event.countDocuments(await buildAccessibleEventFilter(userId.toString()));

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_moderation_test" });
}, 120_000);

afterEach(async () => {
  await Promise.all([
    Event.deleteMany({}),
    db().collection("users").deleteMany({}),
    db().collection("refreshtokens").deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const seed = async () => {
  await db()
    .collection("users")
    .insertMany([
      { _id: HOST, username: "host" },
      { _id: VIEWER, username: "viewer" },
    ]);
  await db()
    .collection("refreshtokens")
    .insertMany([{ userId: HOST }, { userId: HOST }, { userId: VIEWER }]);
  return publicFlare();
};

describe("suspend and unsuspend", () => {
  it("a dry run changes nothing", async () => {
    await seed();

    const result = await suspendUser("@host", false);

    expect(result.changed).toBe(false);
    expect(result.lines).toContain("refresh tokens to delete: 2");
    expect(await visibleTo(VIEWER)).toBe(1);
    expect(await db().collection("refreshtokens").countDocuments()).toBe(3);
  });

  it("--apply ends the host's sessions and hides their flares, unsuspend brings them back", async () => {
    await seed();

    await suspendUser("host", true);

    expect(await visibleTo(VIEWER)).toBe(0);
    expect(await db().collection("refreshtokens").countDocuments({ userId: HOST })).toBe(0);
    expect(await db().collection("refreshtokens").countDocuments({ userId: VIEWER })).toBe(1);

    await unsuspendUser("host", true);

    expect(await visibleTo(VIEWER)).toBe(1);
  });

  it("an unknown username fails without changing anything", async () => {
    await seed();

    await expect(suspendUser("nobody", true)).rejects.toThrow(/no user/);
    expect(await visibleTo(VIEWER)).toBe(1);
  });
});

describe("hide-flare", () => {
  it("removes it for everyone but its host, and a dry run doesn't", async () => {
    const flare = await seed();

    await hideFlare(String(flare._id), false);
    expect(await visibleTo(VIEWER)).toBe(1);

    await hideFlare(String(flare._id), true);
    expect(await visibleTo(VIEWER)).toBe(0);
    expect(await visibleTo(HOST)).toBe(1);
  });
});
