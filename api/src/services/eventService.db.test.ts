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
  Notification,
} from "#models/index";
import {
  createEvent,
  getCircleUpcomingEvents,
  getEventById,
  getEventMembers,
  getEvents,
  inviteEventMembers,
  removeEventMember,
  updateEvent,
  updateMyEventMembership,
} from "#services/eventService";

const HOST_ID = new Types.ObjectId().toString();
const GOING_GUEST_ID = new Types.ObjectId().toString();
const NEW_GUEST_ID = new Types.ObjectId().toString();
const STRANGER_ID = new Types.ObjectId().toString();
const OTHER_STRANGER_ID = new Types.ObjectId().toString();

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
    Block.syncIndexes(),
    Circle.syncIndexes(),
    CircleMember.syncIndexes(),
    Connection.syncIndexes(),
    Event.syncIndexes(),
    EventMember.syncIndexes(),
    Notification.syncIndexes(),
  ]);
}, 120_000);

afterEach(async () => {
  await Promise.all([
    Block.deleteMany({}),
    Circle.deleteMany({}),
    CircleMember.deleteMany({}),
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

const seedFlareWithGoingGuest = async (visibility: "private" | "public" = "private") => {
  const hostObjectId = new Types.ObjectId(HOST_ID);
  await Connection.create(
    [GOING_GUEST_ID, NEW_GUEST_ID].map((guestId) => ({
      requesterId: hostObjectId,
      receiverId: new Types.ObjectId(guestId),
      status: "accepted" as const,
      type: "qr" as const,
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
    visibility,
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

describe("eventService remove-guest database behavior", () => {
  it("hides even a public flare from a removed guest, drops them from the counts, and restores them on re-invite", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");

    // Before: the going guest sees the flare and counts as attending.
    expect((await getEventById(GOING_GUEST_ID, eventId)).goingCount).toBe(2);

    const removed = await removeEventMember(HOST_ID, eventId, GOING_GUEST_ID);
    expect(removed).toEqual({ removedUserId: GOING_GUEST_ID, notified: true });

    // The row is kept, only marked removed.
    const row = await EventMember.findOne({ eventId, userId: GOING_GUEST_ID }).lean();
    expect(row?.removedAt).toBeInstanceOf(Date);

    // Gone for the guest everywhere, even though the flare is public.
    await expect(getEventById(GOING_GUEST_ID, eventId)).rejects.toMatchObject({ statusCode: 404 });
    const listed = await getEvents(GOING_GUEST_ID, { page: 1, limit: 20 } as never);
    expect(listed.data.map((event) => String(event._id))).not.toContain(eventId);

    // Still there for the host, but the removed guest no longer counts.
    const hostView = await getEventById(HOST_ID, eventId);
    expect(hostView.goingCount).toBe(1);
    expect(hostView.attendees).toEqual([]);
    expect(await getEventMembers(HOST_ID, eventId)).toEqual([]);

    // One neutral notice, no actor.
    const notices = await Notification.find({
      targetId: eventId,
      type: "event_guest_removed",
    }).lean();
    expect(notices).toHaveLength(1);
    expect(String(notices[0]?.userId)).toBe(GOING_GUEST_ID);
    expect(notices[0]?.actorId).toBeNull();

    // Removing twice is a 404, not a second notice.
    await expect(removeEventMember(HOST_ID, eventId, GOING_GUEST_ID)).rejects.toMatchObject({
      statusCode: 404,
    });

    // Inviting them again restores them as a fresh invitee, and notifies them again.
    const restored = await inviteEventMembers(HOST_ID, eventId, {
      members: [{ userId: GOING_GUEST_ID, role: "guest" }],
      circles: [],
    });
    expect(restored).toEqual({ invitedUserIds: [GOING_GUEST_ID] });

    const back = await EventMember.findOne({ eventId, userId: GOING_GUEST_ID }).lean();
    expect(back).toMatchObject({
      removedAt: null,
      rsvpStatus: "invited",
      memberWillArriveAt: null,
    });
    expect((await getEventById(GOING_GUEST_ID, eventId)).myRsvp).toBe("invited");
    expect(await EventMember.countDocuments({ eventId, userId: GOING_GUEST_ID })).toBe(1);
    expect(
      await Notification.countDocuments({
        targetId: eventId,
        userId: GOING_GUEST_ID,
        type: "event_invitation",
      })
    ).toBe(1);
  });
});

describe("eventService public flare joining database behavior", () => {
  const rsvpNotices = (eventId: string) =>
    Notification.find({ targetId: eventId, type: "event_rsvp_change" }).lean();

  it("lets someone who isn't invited join a public flare, and tells the host once", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");
    const before = await getEventById(HOST_ID, eventId);

    await updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" });

    const row = await EventMember.findOne({ eventId, userId: STRANGER_ID }).lean();
    expect(row).toMatchObject({
      role: "guest",
      rsvpStatus: "going",
      invitedBy: null,
      canInviteGuests: false,
      removedAt: null,
    });

    const seen = await getEventById(STRANGER_ID, eventId);
    expect(seen.myRsvp).toBe("going");
    expect(seen.goingCount).toBe(before.goingCount + 1);

    const notices = await rsvpNotices(eventId);
    expect(notices).toHaveLength(1);
    expect(String(notices[0]?.userId)).toBe(HOST_ID);
    expect(String(notices[0]?.actorId)).toBe(STRANGER_ID);

    // The host sees them flagged as having joined without an invite.
    const guests = await getEventMembers(HOST_ID, eventId);
    expect(guests.find((g) => g.user._id === STRANGER_ID)?.joinedWithoutInvite).toBe(true);
    expect(guests.find((g) => g.user._id === GOING_GUEST_ID)?.joinedWithoutInvite).toBe(false);
  });

  it("copes with a double tap: two simultaneous joins leave one member", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");

    await Promise.all([
      updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" }),
      updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" }),
    ]);

    expect(await EventMember.countDocuments({ eventId, userId: STRANGER_ID })).toBe(1);
  });

  it("doesn't tell the host when a stranger declines, but keeps the answer", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");

    await updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "declined" });

    expect(await EventMember.findOne({ eventId, userId: STRANGER_ID })).toMatchObject({
      rsvpStatus: "declined",
    });
    expect(await rsvpNotices(eventId)).toHaveLength(0);
  });

  it("refuses a stranger on a private flare", async () => {
    const { eventId } = await seedFlareWithGoingGuest("private");

    await expect(
      updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" })
    ).rejects.toMatchObject({ statusCode: 404, code: "EVENT_MEMBERSHIP_NOT_FOUND" });
    expect(await EventMember.countDocuments({ eventId, userId: STRANGER_ID })).toBe(0);
  });

  it("doesn't make someone a guest just for sending an arrival time", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");

    await expect(
      updateMyEventMembership(STRANGER_ID, eventId, {
        memberWillArriveAt: new Date(Date.now() + 3600_000),
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses someone the host has blocked", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");
    await Block.create({
      blockerId: new Types.ObjectId(HOST_ID),
      blockedId: new Types.ObjectId(STRANGER_ID),
    });

    await expect(
      updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("doesn't let a guest the host removed come back through the public door", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");
    await updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" });
    await removeEventMember(HOST_ID, eventId, STRANGER_ID);

    await expect(
      updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("eventService public/private switching database behavior", () => {
  it("keeps going joiners and invited guests when a flare goes private, and hides it from everyone else", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");
    await updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" });
    await updateMyEventMembership(OTHER_STRANGER_ID, eventId, { rsvpStatus: "declined" });
    // A guest the host invites and who hasn't answered yet.
    await inviteEventMembers(HOST_ID, eventId, {
      members: [{ userId: NEW_GUEST_ID, role: "guest" }],
      circles: [],
    });

    await updateEvent(HOST_ID, eventId, { visibility: "private" });

    const rows = await EventMember.find({ eventId }).lean();
    const byUser = new Map(rows.map((row) => [String(row.userId), row]));
    // Kept: the host, both invited guests, the uninvited joiner who's going.
    expect(byUser.has(HOST_ID)).toBe(true);
    expect(byUser.has(GOING_GUEST_ID)).toBe(true);
    expect(byUser.get(NEW_GUEST_ID)).toMatchObject({ rsvpStatus: "invited" });
    expect(byUser.has(STRANGER_ID)).toBe(true);
    // Dropped: the uninvited joiner who declined.
    expect(byUser.has(OTHER_STRANGER_ID)).toBe(false);

    // Members still see it; anyone else no longer does.
    expect((await getEventById(STRANGER_ID, eventId)).myRsvp).toBe("going");
    await expect(getEventById(OTHER_STRANGER_ID, eventId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("keeps the invite list when a private flare goes public", async () => {
    const { eventId } = await seedFlareWithGoingGuest("private");

    await updateEvent(HOST_ID, eventId, { visibility: "public" });

    const guests = await getEventMembers(HOST_ID, eventId);
    expect(guests.map((g) => g.user._id)).toEqual([GOING_GUEST_ID]);
    // Anyone can now see it, and join.
    expect((await getEventById(STRANGER_ID, eventId)).myRsvp).toBeNull();
    await updateMyEventMembership(STRANGER_ID, eventId, { rsvpStatus: "going" });
    expect(await EventMember.countDocuments({ eventId })).toBe(3);
  });

  it("doesn't touch guests on edits that don't switch public to private", async () => {
    const { eventId } = await seedFlareWithGoingGuest("public");
    await updateMyEventMembership(OTHER_STRANGER_ID, eventId, { rsvpStatus: "declined" });

    await updateEvent(HOST_ID, eventId, { title: "friday drinks, moved" });

    expect(await EventMember.countDocuments({ eventId, userId: OTHER_STRANGER_ID })).toBe(1);
  });
});

describe("eventService circle-growth prompt database behavior (#150)", () => {
  const HOUR = 3_600_000;

  const makeCircle = (ownerId = HOST_ID, name = "close friends") =>
    Circle.create({ ownerId: new Types.ObjectId(ownerId), name, type: "custom", color: "#00FF00" });

  const makeFlare = (overrides: Record<string, unknown> = {}) =>
    Event.create({
      hostId: new Types.ObjectId(HOST_ID),
      title: "friday drinks",
      type: "drinks",
      startAt: new Date(Date.now() + 2 * HOUR),
      endAt: new Date(Date.now() + 4 * HOUR),
      locationName: "the annex",
      location: { type: "Point", coordinates: [9.99, 53.55] },
      visibility: "private",
      allowGuestInvites: "none",
      guestInviteLimit: 0,
      status: "active",
      ...overrides,
    });

  it("remembers the circle a flare was posted to, even an empty one, and lists it", async () => {
    const circle = await makeCircle();

    const { event } = await createEvent(HOST_ID, {
      title: "friday drinks",
      description: null,
      type: "drinks",
      startAt: new Date(Date.now() + 2 * HOUR),
      endAt: new Date(Date.now() + 4 * HOUR),
      locationName: "the annex",
      locationAddress: null,
      location: { type: "Point", coordinates: [9.99, 53.55] },
      visibility: "private",
      allowGuestInvites: "none",
      guestInviteLimit: 0,
      members: [],
      circles: [{ circleId: String(circle._id), role: "guest" }],
    });

    const flares = await getCircleUpcomingEvents(HOST_ID, String(circle._id));
    expect(flares.map((flare) => String(flare._id))).toEqual([String(event._id)]);
  });

  it("remembers a circle invited later from edit flare", async () => {
    const circle = await makeCircle();
    const flare = await makeFlare();
    expect(await getCircleUpcomingEvents(HOST_ID, String(circle._id))).toHaveLength(0);

    await inviteEventMembers(HOST_ID, String(flare._id), {
      members: [],
      circles: [{ circleId: String(circle._id), role: "guest" }],
    });

    const listed = await getCircleUpcomingEvents(HOST_ID, String(circle._id));
    expect(listed.map((f) => String(f._id))).toEqual([String(flare._id)]);
    // Inviting the same circle again doesn't record it twice.
    await inviteEventMembers(HOST_ID, String(flare._id), {
      members: [],
      circles: [{ circleId: String(circle._id), role: "guest" }],
    });
    expect((await Event.findById(flare._id).lean())?.invitedCircleIds).toHaveLength(1);
  });

  it("lists only upcoming, active flares for that circle, soonest first", async () => {
    const circle = await makeCircle();
    const otherCircle = await makeCircle(HOST_ID, "inner circle");
    const circleIds = [circle._id];
    const later = await makeFlare({
      title: "later",
      invitedCircleIds: circleIds,
      startAt: new Date(Date.now() + 30 * HOUR),
      endAt: new Date(Date.now() + 32 * HOUR),
    });
    const sooner = await makeFlare({ title: "sooner", invitedCircleIds: circleIds });
    // Live right now (started, not ended) still counts.
    const live = await makeFlare({
      title: "live",
      invitedCircleIds: circleIds,
      startAt: new Date(Date.now() - HOUR),
      endAt: new Date(Date.now() + HOUR),
    });
    // None of these should appear.
    await makeFlare({
      title: "ended",
      invitedCircleIds: circleIds,
      startAt: new Date(Date.now() - 5 * HOUR),
      endAt: new Date(Date.now() - 3 * HOUR),
    });
    await makeFlare({ title: "cancelled", invitedCircleIds: circleIds, status: "cancelled" });
    await makeFlare({ title: "other circle", invitedCircleIds: [otherCircle._id] });
    await makeFlare({ title: "posted before circles were recorded" });

    const listed = await getCircleUpcomingEvents(HOST_ID, String(circle._id));

    expect(listed.map((flare) => flare.title)).toEqual(["live", "sooner", "later"]);
    expect(listed.map((flare) => String(flare._id))).toEqual([
      String(live._id),
      String(sooner._id),
      String(later._id),
    ]);
  });

  it("leaves out flares the person is already on, or was removed from", async () => {
    const circle = await makeCircle();
    const onIt = await makeFlare({ title: "already on it", invitedCircleIds: [circle._id] });
    const removed = await makeFlare({ title: "was removed", invitedCircleIds: [circle._id] });
    await makeFlare({ title: "not on it", invitedCircleIds: [circle._id] });
    await EventMember.create([
      {
        eventId: onIt._id,
        userId: new Types.ObjectId(NEW_GUEST_ID),
        invitedBy: new Types.ObjectId(HOST_ID),
        role: "guest",
        rsvpStatus: "invited",
      },
      {
        eventId: removed._id,
        userId: new Types.ObjectId(NEW_GUEST_ID),
        invitedBy: new Types.ObjectId(HOST_ID),
        role: "guest",
        rsvpStatus: "going",
        removedAt: new Date(),
      },
    ]);

    const listed = await getCircleUpcomingEvents(HOST_ID, String(circle._id), {
      userId: NEW_GUEST_ID,
    });

    expect(listed.map((flare) => flare.title)).toEqual(["not on it"]);
  });

  it("only lets the circle's owner ask, and only about their own flares", async () => {
    const circle = await makeCircle();
    await makeFlare({ invitedCircleIds: [circle._id] });

    await expect(getCircleUpcomingEvents(STRANGER_ID, String(circle._id))).rejects.toMatchObject({
      statusCode: 404,
      code: "CIRCLE_NOT_FOUND",
    });
  });
});

// #172: custom circles used to be filtered out of the audience picker
// entirely on the frontend. The API side of the contract — accepting any
// circle the host owns, regardless of type, and rejecting one they don't —
// already worked; these tests pin that down at the database level.
describe("eventService custom circle audience database behavior (#172)", () => {
  const HOUR = 3_600_000;

  const createEventInput = (overrides: Record<string, unknown> = {}) => ({
    title: "book club",
    description: null,
    type: "drinks" as const,
    startAt: new Date(Date.now() + 2 * HOUR),
    endAt: new Date(Date.now() + 4 * HOUR),
    locationName: "the annex",
    locationAddress: null,
    location: { type: "Point" as const, coordinates: [9.99, 53.55] as [number, number] },
    visibility: "private" as const,
    allowGuestInvites: "none" as const,
    guestInviteLimit: 0,
    members: [],
    circles: [],
    ...overrides,
  });

  const makeCustomCircle = async (ownerId: string, memberIds: string[] = []) => {
    const circle = await Circle.create({
      ownerId: new Types.ObjectId(ownerId),
      name: "book club circle",
      type: "custom",
      color: "#00FF00",
    });
    if (memberIds.length > 0) {
      await CircleMember.create(
        memberIds.map((userId) => ({
          circleId: circle._id,
          ownerId: new Types.ObjectId(ownerId),
          userId: new Types.ObjectId(userId),
        }))
      );
    }
    return circle;
  };

  it("invites a custom circle's members when it's picked as the flare's sole audience", async () => {
    await Connection.create({
      requesterId: new Types.ObjectId(HOST_ID),
      receiverId: new Types.ObjectId(NEW_GUEST_ID),
      status: "accepted",
      type: "qr",
    });
    const circle = await makeCustomCircle(HOST_ID, [NEW_GUEST_ID]);

    const { event } = await createEvent(
      HOST_ID,
      createEventInput({ circles: [{ circleId: String(circle._id), role: "guest" }] })
    );

    const members = await EventMember.find({ eventId: event._id }).lean();
    expect(members.map((m) => String(m.userId)).sort()).toEqual([HOST_ID, NEW_GUEST_ID].sort());

    const stored = await Event.findById(event._id).lean();
    expect(stored?.invitedCircleIds?.map((id) => String(id))).toEqual([String(circle._id)]);
  });

  it("rejects a custom circle owned by someone else", async () => {
    const strangerCircle = await makeCustomCircle(STRANGER_ID);

    await expect(
      createEvent(
        HOST_ID,
        createEventInput({ circles: [{ circleId: String(strangerCircle._id), role: "guest" }] })
      )
    ).rejects.toMatchObject({ statusCode: 404, code: "CIRCLE_NOT_FOUND" });

    expect(await Event.countDocuments({})).toBe(0);
  });
});
