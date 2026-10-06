import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  Block,
  Circle,
  Connection,
  Event,
  EventMember,
  Notification,
  NotificationSettings,
} from "#models/index";
import {
  connectInPerson,
  respondToConnectionRequest,
  sendConnectionRequest,
} from "#services/connectionService";

// #426: a friend who connects while a host's "all friends" flare is upcoming or
// live is added to it, through each of the three ways a connection is accepted.

const HOST_ID = new Types.ObjectId().toString();
const FRIEND_ID = new Types.ObjectId().toString();

let mongoServer: MongoMemoryReplSet;

const oid = (id: string) => new Types.ObjectId(id);

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_all_friends_flares_test" });
  await Promise.all([
    Block.syncIndexes(),
    Circle.syncIndexes(),
    Connection.syncIndexes(),
    Event.syncIndexes(),
    EventMember.syncIndexes(),
    Notification.syncIndexes(),
    NotificationSettings.syncIndexes(),
  ]);
}, 120_000);

afterEach(async () => {
  await Promise.all([
    Block.deleteMany({}),
    Circle.deleteMany({}),
    Connection.deleteMany({}),
    Event.deleteMany({}),
    EventMember.deleteMany({}),
    Notification.deleteMany({}),
    NotificationSettings.deleteMany({}),
    mongoose.connection.db!.collection("users").deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const HOUR = 60 * 60 * 1000;

const seedUsers = async () => {
  await mongoose.connection.db!.collection("users").insertMany([
    { _id: oid(HOST_ID), username: "martin", displayName: "Martin" },
    { _id: oid(FRIEND_ID), username: "lena", displayName: "Lena" },
  ]);
};

const seedCircles = async (ownerId: string) => {
  const [all, custom] = await Circle.create([
    { ownerId: oid(ownerId), name: "all friends", type: "all" },
    { ownerId: oid(ownerId), name: "climbing", type: "custom" },
  ]);
  return { allId: all!._id, customId: custom!._id };
};

const seedFlare = async ({
  hostId = HOST_ID,
  circleIds,
  title = "friday drinks",
  status = "active",
  endAt = new Date(Date.now() + 3 * HOUR),
  allowGuestInvites = "none",
}: {
  hostId?: string;
  circleIds: Types.ObjectId[];
  title?: string;
  status?: "active" | "cancelled" | "completed";
  endAt?: Date;
  allowGuestInvites?: "none" | "single" | "multiple";
}) => {
  const event = await Event.create({
    hostId: oid(hostId),
    title,
    type: "drinks",
    startAt: new Date(Date.now() + HOUR),
    endAt,
    locationName: "the annex",
    location: { type: "Point", coordinates: [9.99, 53.55] },
    visibility: "private",
    allowGuestInvites,
    guestInviteLimit: 0,
    invitedCircleIds: circleIds,
    status,
  });
  await EventMember.create({
    eventId: event._id,
    userId: oid(hostId),
    role: "host",
    rsvpStatus: "going",
    canInviteGuests: true,
  });
  return event._id;
};

const friendRow = (eventId: Types.ObjectId, userId = FRIEND_ID) =>
  EventMember.findOne({ eventId, userId: oid(userId) }).lean();

const invitationsFor = (userId: string) =>
  Notification.find({ userId: oid(userId), type: "event_invitation" }).lean();

const mirrorRows = async (status: "accepted" | "pending" = "accepted") => {
  await Connection.create([
    { requesterId: oid(HOST_ID), receiverId: oid(FRIEND_ID), status, type: "qr" },
    { requesterId: oid(FRIEND_ID), receiverId: oid(HOST_ID), status, type: "qr" },
  ]);
};

/** The three ways a connection becomes accepted, each ending with the pair connected. */
const acceptPaths: Array<[string, () => Promise<unknown>]> = [
  [
    "a reverse pending request auto-accepted",
    async () => {
      const pending = await Connection.create({
        requesterId: oid(HOST_ID),
        receiverId: oid(FRIEND_ID),
        status: "pending",
        type: "shared_invitation",
      });
      await sendConnectionRequest(FRIEND_ID, { receiverId: HOST_ID, type: "shared_invitation" });
      return pending;
    },
  ],
  ["an in-person QR connect", () => connectInPerson(FRIEND_ID, HOST_ID)],
  [
    "accepting a pending request",
    async () => {
      const pending = await Connection.create({
        requesterId: oid(FRIEND_ID),
        receiverId: oid(HOST_ID),
        status: "pending",
        type: "shared_invitation",
      });
      await respondToConnectionRequest(HOST_ID, String(pending._id), { status: "accepted" });
    },
  ],
];

describe.each(acceptPaths)("all-friends flares pick up a new friend via %s (#426)", (_, accept) => {
  it("adds the friend as an invited guest to the host's live and upcoming all-friends flares and notifies them", async () => {
    await seedUsers();
    const { allId } = await seedCircles(HOST_ID);
    const upcoming = await seedFlare({ circleIds: [allId], allowGuestInvites: "single" });
    const live = await seedFlare({ circleIds: [allId], title: "board games" });

    await accept();

    const row = await friendRow(upcoming);
    expect(row).toMatchObject({
      role: "guest",
      rsvpStatus: "invited",
      canInviteGuests: true,
      removedAt: null,
    });
    expect(String(row?.invitedBy)).toBe(HOST_ID);
    expect(await friendRow(live)).toMatchObject({ role: "guest", canInviteGuests: false });

    const notifications = await invitationsFor(FRIEND_ID);
    expect(notifications.map((n) => String(n.targetId)).sort()).toEqual(
      [String(upcoming), String(live)].sort()
    );
    expect(notifications.every((n) => String(n.actorId) === HOST_ID)).toBe(true);
  });

  it("adds the host to the friend's all-friends flares too", async () => {
    await seedUsers();
    const { allId } = await seedCircles(FRIEND_ID);
    const friendFlare = await seedFlare({ hostId: FRIEND_ID, circleIds: [allId] });

    await accept();

    expect(await friendRow(friendFlare, HOST_ID)).toMatchObject({ rsvpStatus: "invited" });
    expect(await invitationsFor(HOST_ID)).toHaveLength(1);
  });
});

describe("addNewFriendsToAllFriendsFlares rules (#426)", () => {
  it("leaves ended, cancelled, completed and non-all-friends flares untouched", async () => {
    await seedUsers();
    const { allId, customId } = await seedCircles(HOST_ID);
    const ended = await seedFlare({ circleIds: [allId], endAt: new Date(Date.now() - HOUR) });
    const cancelled = await seedFlare({ circleIds: [allId], status: "cancelled" });
    const completed = await seedFlare({ circleIds: [allId], status: "completed" });
    const customOnly = await seedFlare({ circleIds: [customId] });
    const noCircles = await seedFlare({ circleIds: [] });

    await connectInPerson(FRIEND_ID, HOST_ID);

    for (const eventId of [ended, cancelled, completed, customOnly, noCircles]) {
      expect(await friendRow(eventId)).toBeNull();
    }
    expect(await invitationsFor(FRIEND_ID)).toHaveLength(0);
  });

  it("does not touch a flare that went to another host's all-friends circle", async () => {
    await seedUsers();
    const other = new Types.ObjectId().toString();
    const { allId: otherAllId } = await seedCircles(other);
    const othersFlare = await seedFlare({ hostId: other, circleIds: [otherAllId] });

    await connectInPerson(FRIEND_ID, HOST_ID);

    expect(await friendRow(othersFlare)).toBeNull();
  });

  it("keeps a guest the host removed removed, and leaves an existing RSVP alone", async () => {
    await seedUsers();
    const { allId } = await seedCircles(HOST_ID);
    const removedFlare = await seedFlare({ circleIds: [allId] });
    const goingFlare = await seedFlare({ circleIds: [allId], title: "board games" });
    const removedAt = new Date(Date.now() - HOUR);
    await EventMember.create([
      {
        eventId: removedFlare,
        userId: oid(FRIEND_ID),
        invitedBy: oid(HOST_ID),
        role: "guest",
        rsvpStatus: "going",
        removedAt,
      },
      {
        eventId: goingFlare,
        userId: oid(FRIEND_ID),
        invitedBy: oid(HOST_ID),
        role: "guest",
        rsvpStatus: "going",
      },
    ]);

    await connectInPerson(FRIEND_ID, HOST_ID);

    expect(await friendRow(removedFlare)).toMatchObject({ rsvpStatus: "going", removedAt });
    expect(await friendRow(goingFlare)).toMatchObject({ rsvpStatus: "going", removedAt: null });
    expect(await invitationsFor(FRIEND_ID)).toHaveLength(0);
  });

  it.each([
    ["the host blocked the friend", HOST_ID, FRIEND_ID],
    ["the friend blocked the host", FRIEND_ID, HOST_ID],
  ])("skips the pair when %s before the request is accepted", async (_, blockerId, blockedId) => {
    await seedUsers();
    const { allId } = await seedCircles(HOST_ID);
    const flare = await seedFlare({ circleIds: [allId] });
    // respondToConnectionRequest doesn't check blocks itself, so the flare rule must.
    await Block.create({ blockerId: oid(blockerId), blockedId: oid(blockedId) });
    const pending = await Connection.create({
      requesterId: oid(FRIEND_ID),
      receiverId: oid(HOST_ID),
      status: "pending",
      type: "shared_invitation",
    });

    await respondToConnectionRequest(HOST_ID, String(pending._id), { status: "accepted" });

    expect(await friendRow(flare)).toBeNull();
    expect(await invitationsFor(FRIEND_ID)).toHaveLength(0);
  });

  it("skips a blocked pair on the in-person and auto-accept paths", async () => {
    await seedUsers();
    const { allId } = await seedCircles(HOST_ID);
    const flare = await seedFlare({ circleIds: [allId] });
    await Block.create({ blockerId: oid(FRIEND_ID), blockedId: oid(HOST_ID) });

    await connectInPerson(FRIEND_ID, HOST_ID);
    await sendConnectionRequest(FRIEND_ID, { receiverId: HOST_ID, type: "shared_invitation" });

    expect(await friendRow(flare)).toBeNull();
  });

  it("doesn't add anyone for an already-connected pair or a still-pending request", async () => {
    await seedUsers();
    const { allId } = await seedCircles(HOST_ID);
    const flare = await seedFlare({ circleIds: [allId] });

    await sendConnectionRequest(FRIEND_ID, { receiverId: HOST_ID, type: "shared_invitation" });
    expect(await friendRow(flare)).toBeNull();

    // Connected earlier, then the host lit a flare: scanning again is a no-op.
    await Connection.deleteMany({});
    await mirrorRows();
    await connectInPerson(FRIEND_ID, HOST_ID);
    expect(await friendRow(flare)).toBeNull();
  });

  it("respects the friend's invitation-notification opt-out but still adds them", async () => {
    await seedUsers();
    const { allId } = await seedCircles(HOST_ID);
    const flare = await seedFlare({ circleIds: [allId] });
    await NotificationSettings.create({ userId: oid(FRIEND_ID), invitationNotifications: false });

    await connectInPerson(FRIEND_ID, HOST_ID);

    expect(await friendRow(flare)).toMatchObject({ rsvpStatus: "invited" });
    expect(await invitationsFor(FRIEND_ID)).toHaveLength(0);
  });
});
