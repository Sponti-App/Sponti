import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  Block,
  Circle,
  CircleMember,
  Connection,
  Event,
  EventMember,
  EventUpdate,
  InviteLink,
  Notification,
  NotificationSettings,
  QrContactToken,
} from "#models/index";
import { purgeDeletedAccounts, TOMBSTONE_GRACE_MS } from "#services/accountPurgeService";

// #449: the api's purge of a deleted account, against an in-memory Mongo.
// D deleted their account long enough ago for the tombstone to go; F and G are
// friends whose own data must survive.

const D = new Types.ObjectId();
const F = new Types.ObjectId();
const G = new Types.ObjectId();
const NOW = new Date();

let mongoServer: MongoMemoryReplSet;

const users = () => mongoose.connection.db!.collection("users");

const flare = (hostId: Types.ObjectId, overrides: Record<string, unknown> = {}) =>
  Event.create({
    hostId,
    title: "picnic",
    type: "hangout",
    startAt: new Date(NOW.getTime() - 10 * 60_000),
    endAt: new Date(NOW.getTime() + 60 * 60_000),
    locationName: "park",
    location: { type: "Point", coordinates: [13.38, 52.55] },
    visibility: "private",
    status: "active",
    ...overrides,
  });

const member = (eventId: unknown, userId: Types.ObjectId, extra: Record<string, unknown> = {}) =>
  EventMember.collection.insertOne({
    eventId,
    userId,
    role: "guest",
    rsvpStatus: "going",
    invitedBy: null,
    ...extra,
  });

const notification = (userId: Types.ObjectId, actorId: Types.ObjectId | null, targetId: unknown) =>
  Notification.collection.insertOne({
    userId,
    actorId,
    type: "connection_accepted",
    targetType: "user",
    targetId,
    title: "t",
    body: "b",
  });

const seed = async (deletedAgoMs: number) => {
  await users().insertMany([
    {
      _id: D,
      username: `deleted-${D.toString()}`,
      deletedAt: new Date(NOW.getTime() - deletedAgoMs),
    },
    { _id: F, username: "friend" },
    { _id: G, username: "guest" },
  ]);

  const theirs = await flare(D);
  const ended = await flare(D, {
    startAt: new Date(NOW.getTime() - 3 * 3_600_000),
    endAt: new Date(NOW.getTime() - 2 * 3_600_000),
  });
  const friends = await flare(F);
  await member(theirs._id, F);
  await member(ended._id, F);
  await member(friends._id, D);
  await member(friends._id, G, { invitedBy: D });
  await EventUpdate.collection.insertMany([
    { eventId: friends._id, authorId: D, body: "on my way" },
    { eventId: friends._id, authorId: F, body: "see you" },
  ]);

  await Connection.collection.insertMany([
    { requesterId: D, receiverId: F, status: "accepted" },
    { requesterId: F, receiverId: D, status: "accepted" },
    { requesterId: F, receiverId: G, status: "accepted" },
    { requesterId: G, receiverId: F, status: "accepted" },
  ]);
  await Block.collection.insertOne({ blockerId: G, blockedId: D });

  const theirCircle = await Circle.collection.insertOne({
    ownerId: D,
    name: "mine",
    type: "custom",
  });
  const friendsCircle = await Circle.collection.insertOne({
    ownerId: F,
    name: "studio",
    type: "custom",
  });
  await CircleMember.collection.insertMany([
    { circleId: theirCircle.insertedId, ownerId: D, userId: F },
    { circleId: friendsCircle.insertedId, ownerId: F, userId: D },
    { circleId: friendsCircle.insertedId, ownerId: F, userId: G },
  ]);

  await notification(D, F, F);
  await notification(F, D, D);
  await notification(F, G, G);
  await InviteLink.collection.insertOne({ userId: D, token: "x" });
  await QrContactToken.collection.insertOne({ userId: D, token: "y" });
  await NotificationSettings.collection.insertOne({ userId: D });

  return { theirs, friends, friendsCircle: friendsCircle.insertedId };
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_purge_test" });
}, 120_000);

afterEach(async () => {
  await mongoose.connection.db!.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

describe("purgeDeletedAccounts", () => {
  it("erases everything of a deleted account and nothing of anyone else", async () => {
    const { theirs, friends, friendsCircle } = await seed(TOMBSTONE_GRACE_MS + 60_000);

    const summaries = await purgeDeletedAccounts(NOW);

    expect(summaries).toEqual([{ userId: D.toString(), tombstoneRemoved: true }]);
    expect(await users().countDocuments({ _id: D })).toBe(0);

    // Their flares are gone; the live one was cancelled first, so the guest
    // keeps a cancellation notice with no actor.
    expect(await Event.countDocuments({ hostId: D })).toBe(0);
    expect(await EventMember.countDocuments({ eventId: theirs._id })).toBe(0);
    const notices = await Notification.find({ userId: F, type: "event_cancelled" }).lean();
    expect(notices).toHaveLength(1);
    expect(notices[0]?.actorId ?? null).toBeNull();

    // Their traces on a friend's flare go; the friend's flare and guests stay.
    expect(await Event.countDocuments({ _id: friends._id })).toBe(1);
    expect(await EventMember.countDocuments({ userId: D })).toBe(0);
    const guest = await EventMember.findOne({ eventId: friends._id, userId: G }).lean();
    expect(guest?.invitedBy ?? null).toBeNull();
    expect(await EventUpdate.countDocuments({ authorId: D })).toBe(0);
    expect(await EventUpdate.countDocuments({ authorId: F })).toBe(1);

    // Relationships, circles and notifications.
    const either = (a: string, b: string) => ({ $or: [{ [a]: D }, { [b]: D }] });
    expect(await Connection.countDocuments(either("requesterId", "receiverId"))).toBe(0);
    expect(await Connection.countDocuments()).toBe(2);
    expect(await Block.countDocuments(either("blockerId", "blockedId"))).toBe(0);
    expect(await Circle.countDocuments({ ownerId: D })).toBe(0);
    expect(await CircleMember.countDocuments(either("ownerId", "userId"))).toBe(0);
    expect(await CircleMember.countDocuments({ circleId: friendsCircle })).toBe(1);
    expect(await Notification.countDocuments(either("userId", "actorId"))).toBe(0);
    expect(await Notification.countDocuments({ userId: F, actorId: G })).toBe(1);
    expect(await InviteLink.countDocuments({ userId: D })).toBe(0);
    expect(await QrContactToken.countDocuments({ userId: D })).toBe(0);
    expect(await NotificationSettings.countDocuments({ userId: D })).toBe(0);
  });

  it("keeps a fresh tombstone for the next run, and a second run is a no-op", async () => {
    await seed(60_000);

    const first = await purgeDeletedAccounts(NOW);
    const second = await purgeDeletedAccounts(NOW);

    expect(first).toEqual([{ userId: D.toString(), tombstoneRemoved: false }]);
    expect(second).toEqual([{ userId: D.toString(), tombstoneRemoved: false }]);
    expect(await users().countDocuments({ _id: D })).toBe(1);
    expect(await Event.countDocuments({ hostId: D })).toBe(0);
    expect(await Notification.countDocuments({ userId: F, type: "event_cancelled" })).toBe(1);
  });

  it("does nothing when nobody has deleted their account", async () => {
    await users().insertOne({ _id: F, username: "friend" });

    expect(await purgeDeletedAccounts(NOW)).toEqual([]);
    expect(await users().countDocuments()).toBe(1);
  });
});
