import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Connection, Event, EventMember, Notification } from "#models/index";
import { getEventMembers, inviteEventMembers } from "#services/eventService";

const HOST_ID = new Types.ObjectId().toString();
const GOING_GUEST_ID = new Types.ObjectId().toString();
const NEW_GUEST_ID = new Types.ObjectId().toString();

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "sponti_event_service_test",
  });
  await Promise.all([
    Connection.syncIndexes(),
    Event.syncIndexes(),
    EventMember.syncIndexes(),
    Notification.syncIndexes(),
  ]);
}, 120_000);

afterEach(async () => {
  await Promise.all([
    Connection.deleteMany({}),
    Event.deleteMany({}),
    EventMember.deleteMany({}),
    Notification.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const seedFlareWithGoingGuest = async () => {
  const hostObjectId = new Types.ObjectId(HOST_ID);
  await Connection.create(
    [GOING_GUEST_ID, NEW_GUEST_ID].map((guestId) => ({
      requesterId: hostObjectId,
      receiverId: new Types.ObjectId(guestId),
      status: "accepted",
      type: "qr",
    }))
  );
  const event = await Event.create({
    hostId: hostObjectId,
    title: "friday drinks",
    type: "drinks",
    startAt: new Date(Date.now() + 60 * 60 * 1000),
    endAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    locationName: "the annex",
    location: { type: "Point", coordinates: [9.99, 53.55] },
    visibility: "private",
    allowGuestInvites: "none",
    guestInviteLimit: 0,
    status: "active",
  });
  const arrival = new Date(Date.now() + 90 * 60 * 1000);
  await EventMember.create([
    { eventId: event._id, userId: hostObjectId, role: "host", rsvpStatus: "going" },
    {
      eventId: event._id,
      userId: new Types.ObjectId(GOING_GUEST_ID),
      invitedBy: hostObjectId,
      role: "guest",
      rsvpStatus: "going",
      memberWillArriveAt: arrival,
    },
  ]);

  return { eventId: String(event._id), arrival };
};

describe("eventService invite-more database behavior", () => {
  it("adds only new invitees, leaves existing RSVPs alone, and notifies once", async () => {
    const { eventId, arrival } = await seedFlareWithGoingGuest();
    const invite = {
      members: [
        { userId: GOING_GUEST_ID, role: "guest" as const },
        { userId: NEW_GUEST_ID, role: "guest" as const },
      ],
      circles: [],
    };

    const first = await inviteEventMembers(HOST_ID, eventId, invite);
    const repeat = await inviteEventMembers(HOST_ID, eventId, invite);

    expect(first).toEqual({ invitedUserIds: [NEW_GUEST_ID] });
    expect(repeat).toEqual({ invitedUserIds: [] });

    const goingGuest = await EventMember.findOne({
      eventId,
      userId: GOING_GUEST_ID,
    }).lean();
    expect(goingGuest).toMatchObject({ rsvpStatus: "going", memberWillArriveAt: arrival });

    const newGuest = await EventMember.findOne({ eventId, userId: NEW_GUEST_ID }).lean();
    expect(newGuest).toMatchObject({ role: "guest", rsvpStatus: "invited" });
    expect(String(newGuest?.invitedBy)).toBe(HOST_ID);
    expect(newGuest?.createdAt).toBeInstanceOf(Date);

    const notifications = await Notification.find({ targetId: eventId }).lean();
    expect(notifications.map((doc) => String(doc.userId))).toEqual([NEW_GUEST_ID]);

    const guestList = await getEventMembers(HOST_ID, eventId);
    expect(guestList.map((member) => [member.user._id, member.rsvpStatus])).toEqual([
      [GOING_GUEST_ID, "going"],
      [NEW_GUEST_ID, "invited"],
    ]);
  });
});
