import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

const { Notification, NotificationSettings, PushSubscription } = await import("#models/index");
const {
  buildPushPayload,
  configurePush,
  isInQuietHours,
  pushNotifications,
  registerPushSubscription,
} = await import("#services/pushService");
const { runAfterCommit, withTransactionFallback } = await import("#utils/transactions");

const HOST_ID = new Types.ObjectId().toString();
const EVENT_ID = new Types.ObjectId().toString();
const KEYS = { p256dh: "p256dh-key", auth: "auth-key" };

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_push_service_test" });
  await PushSubscription.syncIndexes();
  configurePush({ publicKey: "pub", privateKey: "priv", subject: "mailto:test@sponti.fun" });
}, 120_000);

afterEach(async () => {
  sendNotification.mockReset();
  await Promise.all([
    Notification.deleteMany({}),
    NotificationSettings.deleteMany({}),
    PushSubscription.deleteMany({}),
  ]);
});

afterAll(async () => {
  configurePush(null);
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const join = () =>
  Notification.create({
    userId: new Types.ObjectId(HOST_ID),
    actorId: new Types.ObjectId(),
    type: "event_rsvp_change",
    targetType: "event",
    targetId: new Types.ObjectId(EVENT_ID),
    title: "someone joined your flare",
    message: "someone is going to drinks.",
    metadata: { eventTitle: "drinks at the canal", rsvpStatus: "going", rsvpChange: "joined" },
  });

const sentPayloads = () =>
  sendNotification.mock.calls.map(([, payload]) => JSON.parse(payload as string));

describe("isInQuietHours", () => {
  it("reads the window in the device's timezone and wraps past midnight", () => {
    const at = new Date("2026-10-30T22:30:00Z"); // 23:30 in Berlin (CET)
    expect(isInQuietHours(at, "Europe/Berlin", "22:00", "08:00")).toBe(true);
    expect(isInQuietHours(at, "America/New_York", "22:00", "08:00")).toBe(false);
    expect(isInQuietHours(at, "Europe/Berlin", "13:00", "15:00")).toBe(false);
    expect(isInQuietHours(at, "Not/AZone", "22:00", "23:00")).toBe(true); // falls back to UTC
    expect(isInQuietHours(at, "UTC", "08:00", "08:00")).toBe(false);
  });
});

describe("buildPushPayload", () => {
  it("shows a name and the flare's title, and batches joins", async () => {
    const n = (await join()).toObject();
    expect(buildPushPayload(n, "mia")).toEqual({
      title: "mia joined your flare",
      body: "drinks at the canal",
      url: `/?flare=${EVENT_ID}`,
      tag: `joins-${EVENT_ID}`,
    });
    expect(buildPushPayload(n, "mia", 2).title).toBe("mia and 2 others joined your flare");
  });
});

describe("pushNotifications", () => {
  it("sends to each of the recipient's devices and batches recent joins", async () => {
    await registerPushSubscription(HOST_ID, { endpoint: "https://push.example/a", keys: KEYS });
    await registerPushSubscription(HOST_ID, { endpoint: "https://push.example/b", keys: KEYS });
    await join();
    const second = await join();

    await pushNotifications([second.toObject()]);

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sentPayloads()[0].title).toBe("someone and 1 other joined your flare");
  });

  it("skips arrival updates, the join switch and quiet hours", async () => {
    await registerPushSubscription(HOST_ID, {
      endpoint: "https://push.example/a",
      keys: KEYS,
      timeZone: "UTC",
    });
    const update = (await join()).toObject();
    await pushNotifications([{ ...update, metadata: { rsvpChange: "arrival_updated" } }]);
    expect(sendNotification).not.toHaveBeenCalled();

    await NotificationSettings.create({ userId: HOST_ID, joinNotifications: false });
    await pushNotifications([update]);
    expect(sendNotification).not.toHaveBeenCalled();

    await NotificationSettings.updateOne(
      { userId: HOST_ID },
      {
        joinNotifications: true,
        quietHoursEnabled: true,
        quietHoursStart: "00:00",
        quietHoursEnd: "23:59",
      }
    );
    await pushNotifications([update]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("deletes a subscription the push service says is gone", async () => {
    await registerPushSubscription(HOST_ID, { endpoint: "https://push.example/a", keys: KEYS });
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));

    await pushNotifications([(await join()).toObject()]);

    expect(await PushSubscription.countDocuments()).toBe(0);
  });

  it("moves a re-registered endpoint to the new user", async () => {
    const other = new Types.ObjectId().toString();
    await registerPushSubscription(HOST_ID, { endpoint: "https://push.example/a", keys: KEYS });
    await registerPushSubscription(other, { endpoint: "https://push.example/a", keys: KEYS });

    const subs = await PushSubscription.find().lean();
    expect(subs).toHaveLength(1);
    expect(String(subs[0]?.userId)).toBe(other);
  });
});

describe("runAfterCommit", () => {
  it("runs once after a commit and never for a rolled-back write", async () => {
    const fn = vi.fn();
    await withTransactionFallback(async (session) => runAfterCommit(session, fn));
    expect(fn).toHaveBeenCalledTimes(1);

    const rolledBack = vi.fn();
    await expect(
      withTransactionFallback(async (session) => {
        runAfterCommit(session, rolledBack);
        throw new Error("abort");
      })
    ).rejects.toThrow("abort");
    expect(rolledBack).not.toHaveBeenCalled();
  });
});
