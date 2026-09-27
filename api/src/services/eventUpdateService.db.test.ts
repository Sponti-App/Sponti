import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Block, Event, EventMember, EventUpdate, Notification } from "#models/index";
import {
  cancelEvent,
  getEventById,
  reactivateEvent,
  removeEventMember,
  updateMyEventMembership,
} from "#services/eventService";
import {
  createEventUpdate,
  deleteEventUpdate,
  listEventUpdates,
} from "#services/eventUpdateService";

const HOST_ID = new Types.ObjectId().toString();
const GOING_ID = new Types.ObjectId().toString();
const OTHER_GOING_ID = new Types.ObjectId().toString();
const INVITED_ID = new Types.ObjectId().toString();
const DECLINED_ID = new Types.ObjectId().toString();
const REMOVED_ID = new Types.ObjectId().toString();
const STRANGER_ID = new Types.ObjectId().toString();

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "sponti_event_update_service_test",
  });
  await Promise.all([
    Block.syncIndexes(),
    Event.syncIndexes(),
    EventMember.syncIndexes(),
    EventUpdate.syncIndexes(),
    Notification.syncIndexes(),
  ]);
}, 120_000);

afterEach(async () => {
  await Promise.all([
    Block.deleteMany({}),
    Event.deleteMany({}),
    EventMember.deleteMany({}),
    EventUpdate.deleteMany({}),
    Notification.deleteMany({}),
    mongoose.connection.db!.collection("users").deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const HOUR = 60 * 60 * 1000;

/**
 * A flare with one member per RSVP state: the host, two going guests, an
 * invited guest, a declined guest and a guest the host removed (who was going).
 */
const seedFlare = async ({
  visibility = "private",
  startAt = new Date(Date.now() + HOUR),
  endAt = new Date(Date.now() + 3 * HOUR),
}: {
  visibility?: "private" | "public";
  startAt?: Date;
  endAt?: Date;
} = {}) => {
  const hostObjectId = new Types.ObjectId(HOST_ID);
  const event = await Event.create({
    hostId: hostObjectId,
    title: "friday drinks",
    type: "drinks",
    startAt,
    endAt,
    locationName: "the annex",
    location: { type: "Point", coordinates: [9.99, 53.55] },
    visibility,
    allowGuestInvites: "none",
    guestInviteLimit: 0,
    status: "active",
  });
  const guest = (userId: string, rsvpStatus: "invited" | "going" | "declined") => ({
    eventId: event._id,
    userId: new Types.ObjectId(userId),
    invitedBy: hostObjectId,
    role: "guest" as const,
    rsvpStatus,
  });
  await EventMember.create([
    { eventId: event._id, userId: hostObjectId, role: "host", rsvpStatus: "going" },
    guest(GOING_ID, "going"),
    guest(OTHER_GOING_ID, "going"),
    guest(INVITED_ID, "invited"),
    guest(DECLINED_ID, "declined"),
    { ...guest(REMOVED_ID, "going"), removedAt: new Date() },
  ]);

  return String(event._id);
};

const seedUsers = async () => {
  await mongoose.connection.db!.collection("users").insertMany([
    { _id: new Types.ObjectId(HOST_ID), username: "martin", displayName: "Martin" },
    { _id: new Types.ObjectId(GOING_ID), username: "alex", displayName: "Alex" },
  ]);
};

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

describe("eventUpdateService access (#140)", () => {
  it("lets the host and a going guest post and read, oldest first, with author profiles", async () => {
    await seedUsers();
    const eventId = await seedFlare();

    const first = await createEventUpdate(HOST_ID, eventId, { body: "grabbing a table" });
    const second = await createEventUpdate(GOING_ID, eventId, { body: "running 10 late" });

    expect(first.author).toMatchObject({ _id: HOST_ID, displayName: "Martin", username: "martin" });

    for (const viewerId of [HOST_ID, GOING_ID, OTHER_GOING_ID]) {
      const updates = await listEventUpdates(viewerId, eventId);
      expect(updates.map((update) => update._id)).toEqual([first._id, second._id]);
      expect(updates[1]).toMatchObject({
        body: "running 10 late",
        authorId: GOING_ID,
        author: { _id: GOING_ID, displayName: "Alex", username: "alex", avatarUrl: null },
      });
    }
  });

  it("refuses invited, declined and removed guests, and strangers on a public flare, with 403", async () => {
    const eventId = await seedFlare({ visibility: "public" });

    for (const userId of [INVITED_ID, DECLINED_ID, REMOVED_ID, STRANGER_ID]) {
      await expectAppError(listEventUpdates(userId, eventId), 403, "EVENT_THREAD_FORBIDDEN");
      await expectAppError(
        createEventUpdate(userId, eventId, { body: "hi" }),
        403,
        "EVENT_THREAD_FORBIDDEN"
      );
    }

    expect(await EventUpdate.countDocuments()).toBe(0);
  });

  it("refuses removed guests with 403, and doesn't disclose a private flare to a stranger", async () => {
    const eventId = await seedFlare({ visibility: "private" });

    for (const userId of [INVITED_ID, DECLINED_ID, REMOVED_ID]) {
      await expectAppError(listEventUpdates(userId, eventId), 403, "EVENT_THREAD_FORBIDDEN");
      await expectAppError(
        createEventUpdate(userId, eventId, { body: "hi" }),
        403,
        "EVENT_THREAD_FORBIDDEN"
      );
    }

    // Same answer as GET /events/:id for someone who can't see the flare.
    await expectAppError(listEventUpdates(STRANGER_ID, eventId), 404, "EVENT_NOT_FOUND");
    await expectAppError(
      createEventUpdate(STRANGER_ID, eventId, { body: "hi" }),
      404,
      "EVENT_NOT_FOUND"
    );
  });

  it("refuses a going guest in a block relationship with the host", async () => {
    const eventId = await seedFlare();
    await Block.create({
      blockerId: new Types.ObjectId(HOST_ID),
      blockedId: new Types.ObjectId(GOING_ID),
    });

    await expectAppError(listEventUpdates(GOING_ID, eventId), 403, "EVENT_THREAD_FORBIDDEN");
    await expectAppError(
      createEventUpdate(GOING_ID, eventId, { body: "hi" }),
      403,
      "EVENT_THREAD_FORBIDDEN"
    );
  });

  it("cuts a guest off as soon as they decline or are removed, but keeps their updates for everyone else", async () => {
    const eventId = await seedFlare();
    const byGoing = await createEventUpdate(GOING_ID, eventId, { body: "bringing snacks" });
    const byOther = await createEventUpdate(OTHER_GOING_ID, eventId, { body: "me too" });

    await updateMyEventMembership(GOING_ID, eventId, { rsvpStatus: "declined" });
    await removeEventMember(HOST_ID, eventId, OTHER_GOING_ID);

    for (const userId of [GOING_ID, OTHER_GOING_ID]) {
      await expectAppError(listEventUpdates(userId, eventId), 403, "EVENT_THREAD_FORBIDDEN");
      await expectAppError(
        createEventUpdate(userId, eventId, { body: "still here?" }),
        403,
        "EVENT_THREAD_FORBIDDEN"
      );
    }

    const hostView = await listEventUpdates(HOST_ID, eventId);
    expect(hostView.map((update) => update._id)).toEqual([byGoing._id, byOther._id]);
  });
});

describe("eventUpdateService closed threads (#140)", () => {
  it("rejects posts to a cancelled flare, keeps it readable, and takes posts again once reactivated", async () => {
    const eventId = await seedFlare();
    const before = await createEventUpdate(HOST_ID, eventId, { body: "see you there" });

    await cancelEvent(HOST_ID, eventId);

    await expectAppError(
      createEventUpdate(HOST_ID, eventId, { body: "never mind" }),
      409,
      "EVENT_THREAD_CLOSED"
    );
    await expectAppError(
      createEventUpdate(GOING_ID, eventId, { body: "oh no" }),
      409,
      "EVENT_THREAD_CLOSED"
    );
    expect((await listEventUpdates(GOING_ID, eventId)).map((update) => update._id)).toEqual([
      before._id,
    ]);

    await reactivateEvent(HOST_ID, eventId);

    const after = await createEventUpdate(GOING_ID, eventId, { body: "back on!" });
    expect(after.body).toBe("back on!");
  });

  it("rejects posts to a flare that has ended, but keeps it readable", async () => {
    const eventId = await seedFlare({
      startAt: new Date(Date.now() - 3 * HOUR),
      endAt: new Date(Date.now() - HOUR),
    });
    await EventUpdate.create({
      eventId: new Types.ObjectId(eventId),
      authorId: new Types.ObjectId(HOST_ID),
      body: "thanks for coming",
    });

    await expectAppError(
      createEventUpdate(GOING_ID, eventId, { body: "that was fun" }),
      409,
      "EVENT_THREAD_CLOSED"
    );
    expect(await listEventUpdates(GOING_ID, eventId)).toHaveLength(1);
  });

  it("checks access before saying the thread is closed", async () => {
    const eventId = await seedFlare();
    await cancelEvent(HOST_ID, eventId);

    await expectAppError(
      createEventUpdate(INVITED_ID, eventId, { body: "hi" }),
      403,
      "EVENT_THREAD_FORBIDDEN"
    );
  });
});

describe("eventUpdateService notifications (#140)", () => {
  it("notifies each going guest exactly once when the host posts, and never the host", async () => {
    const eventId = await seedFlare();

    const update = await createEventUpdate(HOST_ID, eventId, { body: "  table by the window  " });

    const notifications = await Notification.find({ type: "event_update" }).lean();
    expect(notifications.map((notification) => String(notification.userId)).sort()).toEqual(
      [GOING_ID, OTHER_GOING_ID].sort()
    );
    for (const notification of notifications) {
      expect(notification).toMatchObject({
        actorId: new Types.ObjectId(HOST_ID),
        targetType: "event",
        targetId: new Types.ObjectId(eventId),
        message: "table by the window",
        metadata: { eventTitle: "friday drinks", updateId: update._id },
      });
    }
  });

  it("doesn't notify anyone when a guest posts", async () => {
    const eventId = await seedFlare();

    await createEventUpdate(GOING_ID, eventId, { body: "on my way" });

    expect(await Notification.countDocuments({ type: "event_update" })).toBe(0);
  });

  it("doesn't notify a going guest in a block relationship with the host", async () => {
    const eventId = await seedFlare();
    await Block.create({
      blockerId: new Types.ObjectId(OTHER_GOING_ID),
      blockedId: new Types.ObjectId(HOST_ID),
    });

    await createEventUpdate(HOST_ID, eventId, { body: "moved inside" });

    const notifications = await Notification.find({ type: "event_update" }).lean();
    expect(notifications.map((notification) => String(notification.userId))).toEqual([GOING_ID]);
  });

  it("shortens a long update to a preview in the notification", async () => {
    const eventId = await seedFlare();

    await createEventUpdate(HOST_ID, eventId, { body: "x".repeat(500) });

    const notification = await Notification.findOne({ type: "event_update" }).lean();
    expect(notification?.message.length).toBeLessThanOrEqual(120);
    expect(notification?.message.endsWith("…")).toBe(true);
  });
});

describe("eventUpdateService deletes and counts (#140)", () => {
  it("lets the author delete their own update and the host delete anyone's, but not another guest", async () => {
    const eventId = await seedFlare();
    const own = await createEventUpdate(GOING_ID, eventId, { body: "mine" });
    const other = await createEventUpdate(OTHER_GOING_ID, eventId, { body: "theirs" });
    const hosts = await createEventUpdate(HOST_ID, eventId, { body: "host's" });

    await expectAppError(
      deleteEventUpdate(GOING_ID, eventId, other._id),
      403,
      "EVENT_UPDATE_DELETE_FORBIDDEN"
    );
    await expectAppError(
      deleteEventUpdate(GOING_ID, eventId, hosts._id),
      403,
      "EVENT_UPDATE_DELETE_FORBIDDEN"
    );

    await deleteEventUpdate(GOING_ID, eventId, own._id);
    await deleteEventUpdate(HOST_ID, eventId, other._id);

    expect((await listEventUpdates(HOST_ID, eventId)).map((update) => update._id)).toEqual([
      hosts._id,
    ]);
    expect((await getEventById(INVITED_ID, eventId)).updateCount).toBe(1);
    // Soft delete: the rows are kept.
    expect(await EventUpdate.countDocuments({ deletedAt: { $ne: null } })).toBe(2);
  });

  it("is idempotent", async () => {
    const eventId = await seedFlare();
    const update = await createEventUpdate(GOING_ID, eventId, { body: "oops" });

    const first = await deleteEventUpdate(GOING_ID, eventId, update._id);
    const second = await deleteEventUpdate(HOST_ID, eventId, update._id);

    expect(second).toEqual(first);
  });

  it("returns 404 for an update that isn't on this flare", async () => {
    const eventId = await seedFlare();
    const otherEventId = await seedFlare();
    const update = await createEventUpdate(GOING_ID, otherEventId, { body: "elsewhere" });

    await expectAppError(
      deleteEventUpdate(HOST_ID, eventId, update._id),
      404,
      "EVENT_UPDATE_NOT_FOUND"
    );
  });

  it("gives anyone who can see the flare its update count, without the updates", async () => {
    const eventId = await seedFlare({ visibility: "public" });
    await createEventUpdate(HOST_ID, eventId, { body: "one" });
    await createEventUpdate(GOING_ID, eventId, { body: "two" });
    await createEventUpdate(OTHER_GOING_ID, eventId, { body: "three" });

    for (const viewerId of [HOST_ID, GOING_ID, INVITED_ID, DECLINED_ID, STRANGER_ID]) {
      const event = await getEventById(viewerId, eventId);
      expect(event.updateCount).toBe(3);
      expect(event).not.toHaveProperty("updates");
    }
  });
});

describe("eventUpdateService block filtering (#140)", () => {
  it("leaves out updates by someone the viewer blocked, or who blocked the viewer", async () => {
    const eventId = await seedFlare();
    const byHost = await createEventUpdate(HOST_ID, eventId, { body: "hello all" });
    const byGoing = await createEventUpdate(GOING_ID, eventId, { body: "from alex" });
    const byOther = await createEventUpdate(OTHER_GOING_ID, eventId, { body: "from sam" });

    await Block.create({
      blockerId: new Types.ObjectId(GOING_ID),
      blockedId: new Types.ObjectId(OTHER_GOING_ID),
    });

    // The blocker doesn't see the blocked user's updates...
    expect((await listEventUpdates(GOING_ID, eventId)).map((update) => update._id)).toEqual([
      byHost._id,
      byGoing._id,
    ]);
    // ...and the blocked user doesn't see the blocker's.
    expect((await listEventUpdates(OTHER_GOING_ID, eventId)).map((update) => update._id)).toEqual([
      byHost._id,
      byOther._id,
    ]);
    // The host, in no block, sees everything.
    expect((await listEventUpdates(HOST_ID, eventId)).map((update) => update._id)).toEqual([
      byHost._id,
      byGoing._id,
      byOther._id,
    ]);
  });
});
