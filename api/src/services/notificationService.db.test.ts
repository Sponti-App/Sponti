import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Notification } from "#models/index";
import { markAllNotificationsRead, markNotificationsReadBatch } from "#services/notificationService";

const USER_ID = new Types.ObjectId().toString();
const OTHER_USER_ID = new Types.ObjectId().toString();

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "sponti_notification_service_test",
  });
  await Notification.syncIndexes();
}, 120_000);

afterEach(async () => {
  await Notification.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const seedNotification = ({
  userId = USER_ID,
  readAt = null,
  createdAt,
}: {
  userId?: string;
  readAt?: Date | null;
  createdAt: Date;
}) =>
  Notification.create({
    userId: new Types.ObjectId(userId),
    actorId: null,
    type: "connection_request",
    targetType: "connection",
    targetId: new Types.ObjectId(),
    title: "someone wants to connect",
    message: "tap to respond",
    readAt,
    createdAt,
    updatedAt: createdAt,
  });

describe("notificationService.markAllNotificationsRead (#176)", () => {
  it("marks all of the caller's unread notifications read, beyond whatever a client had loaded", async () => {
    // 15 unread notifications — more than a single page (limit 10) the
    // client would have fetched, so read-batch alone couldn't reach these.
    const now = new Date();
    await Promise.all(
      Array.from({ length: 15 }, (_, index) =>
        seedNotification({ createdAt: new Date(now.getTime() - index * 1000) })
      )
    );

    const result = await markAllNotificationsRead(USER_ID);

    expect(result.markedRead).toBe(15);
    expect(result.unreadCount).toBe(0);
    expect(await Notification.countDocuments({ userId: new Types.ObjectId(USER_ID), readAt: null })).toBe(
      0
    );
  });

  it("doesn't touch another user's notifications", async () => {
    await seedNotification({ createdAt: new Date() });
    await seedNotification({ userId: OTHER_USER_ID, createdAt: new Date() });

    await markAllNotificationsRead(USER_ID);

    const otherUnread = await Notification.countDocuments({
      userId: new Types.ObjectId(OTHER_USER_ID),
      readAt: null,
    });
    expect(otherUnread).toBe(1);
  });

  it("leaves already-read notifications alone", async () => {
    const readAt = new Date(Date.now() - 60_000);
    const alreadyRead = await seedNotification({
      createdAt: new Date(Date.now() - 60_000),
      readAt,
    });

    await markAllNotificationsRead(USER_ID);

    const stored = await Notification.findById(alreadyRead._id).lean();
    expect(stored?.readAt?.toISOString()).toBe(readAt.toISOString());
  });

  // A notification created mid-request (after the handler computed "now" but
  // before the update runs) must not be swallowed — it should still show up
  // as unread afterwards. We simulate that here by seeding a notification
  // whose createdAt is in the future relative to when markAllNotificationsRead
  // runs, standing in for one that arrives just after the cutoff was taken.
  it("doesn't mark a notification created after the request's cutoff as read", async () => {
    const past = await seedNotification({ createdAt: new Date(Date.now() - 5_000) });
    const future = await seedNotification({ createdAt: new Date(Date.now() + 60_000) });

    const result = await markAllNotificationsRead(USER_ID);

    expect(result.markedRead).toBe(1);
    const pastDoc = await Notification.findById(past._id).lean();
    const futureDoc = await Notification.findById(future._id).lean();
    expect(pastDoc?.readAt).not.toBeNull();
    expect(futureDoc?.readAt).toBeNull();
  });

  it("is idempotent — calling it again with nothing new marks nothing further", async () => {
    await seedNotification({ createdAt: new Date() });
    await markAllNotificationsRead(USER_ID);

    const second = await markAllNotificationsRead(USER_ID);

    expect(second).toEqual({ markedRead: 0, unreadCount: 0 });
  });
});

describe("notificationService.markAllNotificationsRead alongside markNotificationsReadBatch (#176)", () => {
  it("read-all picks up unread notifications a prior read-batch call didn't know about", async () => {
    const known = await seedNotification({ createdAt: new Date(Date.now() - 2_000) });
    await seedNotification({ createdAt: new Date(Date.now() - 1_000) });

    await markNotificationsReadBatch(USER_ID, { notificationIds: [String(known._id)] });
    expect(
      await Notification.countDocuments({ userId: new Types.ObjectId(USER_ID), readAt: null })
    ).toBe(1);

    const result = await markAllNotificationsRead(USER_ID);

    expect(result.unreadCount).toBe(0);
    expect(
      await Notification.countDocuments({ userId: new Types.ObjectId(USER_ID), readAt: null })
    ).toBe(0);
  });
});
