import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "#middleware/rateLimit";
import {
  Block,
  Connection,
  Event,
  EventInviteLink,
  EventMember,
  Notification,
  PendingEventInvite,
} from "#models/index";
import {
  connectInPerson,
  deleteConnection,
  respondToConnectionRequest,
} from "#services/connectionService";
import { cancelEvent } from "#services/eventService";

// #616: a flare's own invite link. Having the link counts as being invited,
// but it never connects strangers and never opens an invite-only flare without
// the host's yes. These run the whole thing over HTTP against an in-memory
// Mongo: who may read the token, what a stranger can see, and each way a link
// is redeemed, accepted, declined or lapses.

const HOST_ID = new Types.ObjectId().toString();
const GUEST_ID = new Types.ObjectId().toString();
const FRIEND_ID = new Types.ObjectId().toString();
const OTHER_ID = new Types.ObjectId().toString();
const JWT_SECRET = "flare-invite-test-secret";
const HOUR = 60 * 60 * 1000;

const SECRETS = {
  description: "description-marker-secret",
  locationAddress: "address-marker-secret",
};

let mongoServer: MongoMemoryReplSet;
let app: Express;

const oid = (id: string) => new Types.ObjectId(id);
const users = () => mongoose.connection.db!.collection("users");
const bearer = (userId: string) => `Bearer ${jwt.sign({ userId }, JWT_SECRET)}`;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_flare_invite_test" });
  await Promise.all([
    Block.syncIndexes(),
    Connection.syncIndexes(),
    Event.syncIndexes(),
    EventInviteLink.syncIndexes(),
    EventMember.syncIndexes(),
    Notification.syncIndexes(),
    PendingEventInvite.syncIndexes(),
  ]);

  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.DB_NAME = "sponti_flare_invite_test";
  process.env.CLIENT_BASE_URL = "http://localhost:3000";
  process.env.ACCESS_JWT_SECRET = JWT_SECRET;
  app = (await import("#app")).createApp();
}, 120_000);

beforeEach(() => {
  resetRateLimits();
});

afterEach(async () => {
  await Promise.all([
    Block.deleteMany({}),
    Connection.deleteMany({}),
    Event.deleteMany({}),
    EventInviteLink.deleteMany({}),
    EventMember.deleteMany({}),
    Notification.deleteMany({}),
    PendingEventInvite.deleteMany({}),
    users().deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const seedUsers = () =>
  users().insertMany([
    {
      _id: oid(HOST_ID),
      username: "patrick",
      displayName: "Patrick",
      avatarUrl: "https://example.com/p.png",
    },
    { _id: oid(GUEST_ID), username: "anna", displayName: "Anna" },
    { _id: oid(FRIEND_ID), username: "lena", displayName: "Lena" },
    { _id: oid(OTHER_ID), username: "jo", displayName: "Jo" },
  ]);

const seedFlare = async (
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; oid: Types.ObjectId }> => {
  const event = await Event.create({
    hostId: oid(HOST_ID),
    title: "drinks at the klunkerkranich",
    description: SECRETS.description,
    type: "drinks",
    startAt: new Date(Date.now() + HOUR),
    endAt: new Date(Date.now() + 3 * HOUR),
    locationName: "klunkerkranich",
    locationAddress: SECRETS.locationAddress,
    location: { type: "Point", coordinates: [13.43, 52.48] },
    visibility: "private",
    status: "active",
    ...overrides,
  });
  await EventMember.create({
    eventId: event._id,
    userId: oid(HOST_ID),
    role: "host",
    rsvpStatus: "going",
    canInviteGuests: true,
  });
  return { id: event._id.toString(), oid: event._id };
};

const befriend = (a: string, b: string) =>
  Connection.create([
    { requesterId: oid(a), receiverId: oid(b), status: "accepted", type: "qr" },
    { requesterId: oid(b), receiverId: oid(a), status: "accepted", type: "qr" },
  ]);

const hostLink = async (eventId: string) => {
  const res = await request(app)
    .get(`/api/v1/events/${eventId}/invite-link`)
    .set("Authorization", bearer(HOST_ID));
  expect(res.status).toBe(200);
  return res.body.data.token as string;
};

const redeem = (userId: string, token: string) =>
  request(app)
    .post("/api/v1/flare-invites/redeem")
    .set("Authorization", bearer(userId))
    .send({ token });

const status = (userId: string, token: string) =>
  request(app)
    .post("/api/v1/flare-invites/status")
    .set("Authorization", bearer(userId))
    .send({ token });

const preview = (token: string) =>
  request(app).post("/api/v1/public/flare-invite-preview").send({ token });

const memberRow = (eventId: string, userId: string) =>
  EventMember.findOne({ eventId: oid(eventId), userId: oid(userId) }).lean();

const pendingRequestFrom = (userId: string, toId = HOST_ID) =>
  Connection.findOne({ requesterId: oid(userId), receiverId: oid(toId), status: "pending" });

const acceptedRows = () => Connection.countDocuments({ status: "accepted" });

const accept = async (guestId = GUEST_ID) => {
  const row = await pendingRequestFrom(guestId);
  return respondToConnectionRequest(HOST_ID, String(row!._id), { status: "accepted" });
};

describe("the host's link (#616)", () => {
  it("is issued on first ask and stays the same until reset", async () => {
    await seedUsers();
    const flare = await seedFlare();

    const first = await hostLink(flare.id);
    const second = await hostLink(flare.id);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await EventInviteLink.countDocuments({ eventId: flare.oid })).toBe(1);
  });

  it("is only readable by the host", async () => {
    await seedUsers();
    const flare = await seedFlare({ visibility: "public" });
    await EventMember.create({
      eventId: flare.oid,
      userId: oid(GUEST_ID),
      role: "guest",
      rsvpStatus: "going",
    });
    await hostLink(flare.id);

    for (const userId of [GUEST_ID, OTHER_ID]) {
      const res = await request(app)
        .get(`/api/v1/events/${flare.id}/invite-link`)
        .set("Authorization", bearer(userId));
      expect(res.status).toBe(404);

      const reset = await request(app)
        .post(`/api/v1/events/${flare.id}/invite-link/reset`)
        .set("Authorization", bearer(userId))
        .send({});
      expect(reset.status).toBe(404);
    }

    expect((await request(app).get(`/api/v1/events/${flare.id}/invite-link`)).status).toBe(401);
  });

  it("reset kills the old link and issues a new one", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const oldToken = await hostLink(flare.id);

    const reset = await request(app)
      .post(`/api/v1/events/${flare.id}/invite-link/reset`)
      .set("Authorization", bearer(HOST_ID))
      .send({});
    expect(reset.status).toBe(201);
    const newToken = reset.body.data.token as string;
    expect(newToken).not.toBe(oldToken);

    expect((await preview(oldToken)).status).toBe(404);
    expect((await redeem(GUEST_ID, oldToken)).status).toBe(404);
    expect((await preview(newToken)).status).toBe(200);
    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();
  });

  it("has no link for a flare that is over or cancelled", async () => {
    await seedUsers();
    const ended = await seedFlare({
      startAt: new Date(Date.now() - 3 * HOUR),
      endAt: new Date(Date.now() - HOUR),
    });
    const cancelled = await seedFlare({ status: "cancelled" });

    for (const flare of [ended, cancelled]) {
      const res = await request(app)
        .get(`/api/v1/events/${flare.id}/invite-link`)
        .set("Authorization", bearer(HOST_ID));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EVENT_NOT_SHAREABLE");
    }
  });

  it("never appears in a payload a guest or the host's lists can read", async () => {
    await seedUsers();
    const flare = await seedFlare({ visibility: "public" });
    await EventMember.create({
      eventId: flare.oid,
      userId: oid(GUEST_ID),
      role: "guest",
      rsvpStatus: "going",
    });
    const token = await hostLink(flare.id);
    await Connection.create({
      requesterId: oid(HOST_ID),
      receiverId: oid(GUEST_ID),
      status: "pending",
      type: "qr",
    });

    const urls = [
      `/api/v1/events/${flare.id}`,
      `/api/v1/events/${flare.id}/members`,
      "/api/v1/events",
      "/api/v1/events/mine/upcoming",
      "/api/v1/events/map/active?lng=13.43&lat=52.48&radiusKm=10",
    ];

    for (const userId of [HOST_ID, GUEST_ID, OTHER_ID]) {
      for (const url of urls) {
        const res = await request(app).get(url).set("Authorization", bearer(userId));
        expect(JSON.stringify(res.body), `${url} as ${userId}`).not.toContain(token);
      }
    }

    const publicMap = await request(app).get(
      "/api/v1/public/events/map?lng=13.43&lat=52.48&radiusKm=10"
    );
    const publicOne = await request(app).get(`/api/v1/public/events/${flare.id}`);
    expect(JSON.stringify(publicMap.body)).not.toContain(token);
    expect(JSON.stringify(publicOne.body)).not.toContain(token);
  });
});

describe("what a link shows without an account (#616)", () => {
  it("is exactly the host, the title, the kind, the time and the place name", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);

    const res = await preview(token);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(Object.keys(res.body.data).sort()).toEqual([
      "endAt",
      "host",
      "placeName",
      "startAt",
      "title",
      "type",
    ]);
    expect(res.body.data.host).toEqual({
      displayName: "Patrick",
      avatarUrl: "https://example.com/p.png",
    });
    expect(res.body.data).toMatchObject({
      title: "drinks at the klunkerkranich",
      type: "drinks",
      placeName: "klunkerkranich",
    });

    // Not the address, the description, the coordinates or the flare's id.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(SECRETS.description);
    expect(body).not.toContain(SECRETS.locationAddress);
    expect(body).not.toContain(flare.id);
    expect(body).not.toContain("13.43");
  });

  it("is the same 404 for an unknown, ended, cancelled or suspended-host link", async () => {
    await seedUsers();
    const ended = await seedFlare();
    const endedToken = await hostLink(ended.id);
    await Event.updateOne({ _id: ended.oid }, { $set: { endAt: new Date(Date.now() - 1000) } });

    const cancelled = await seedFlare();
    const cancelledToken = await hostLink(cancelled.id);
    await Event.updateOne({ _id: cancelled.oid }, { $set: { status: "cancelled" } });

    const suspended = await seedFlare();
    const suspendedToken = await hostLink(suspended.id);
    await users().updateOne({ _id: oid(HOST_ID) }, { $set: { suspendedAt: new Date() } });

    const answers = await Promise.all(
      [endedToken, cancelledToken, suspendedToken, "A".repeat(43)].map(async (token) => {
        const res = await preview(token);
        return [res.status, res.body.error?.code];
      })
    );

    expect(answers).toEqual(Array(4).fill([404, "FLARE_INVITE_NOT_FOUND"]));
  });

  it("rejects a malformed token before it reaches the database", async () => {
    expect((await preview("not a token!")).status).toBe(400);
    expect((await request(app).post("/api/v1/public/flare-invite-preview").send({})).status).toBe(
      400
    );
  });
});

describe("redeeming an open-to-all flare (#616)", () => {
  it("joins the guest as going and sends the host a friend request, not a friendship", async () => {
    await seedUsers();
    const flare = await seedFlare({ visibility: "public" });
    const token = await hostLink(flare.id);

    const res = await redeem(GUEST_ID, token);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ state: "going", eventId: flare.id });
    expect((await memberRow(flare.id, GUEST_ID))?.rsvpStatus).toBe("going");

    expect(await pendingRequestFrom(GUEST_ID)).not.toBeNull();
    expect(await acceptedRows()).toBe(0);
    const request_ = await Notification.findOne({
      userId: oid(HOST_ID),
      type: "connection_request",
    }).lean();
    expect(request_).toMatchObject({
      title: "Anna joined via your link",
      actorId: oid(GUEST_ID),
    });
    expect(request_?.metadata).toMatchObject({
      flareInvite: { eventId: flare.id, kind: "joined" },
    });
    // No pending invite: an open-to-all flare needs none.
    expect(await PendingEventInvite.countDocuments({})).toBe(0);
  });

  it("sends no friend request to someone who is already a friend", async () => {
    await seedUsers();
    await befriend(HOST_ID, GUEST_ID);
    const flare = await seedFlare({ visibility: "public" });
    const token = await hostLink(flare.id);

    const res = await redeem(GUEST_ID, token);

    expect(res.body.data.state).toBe("going");
    expect(await Connection.countDocuments({ status: "pending" })).toBe(0);
    expect(await Notification.countDocuments({ type: "connection_request" })).toBe(0);
  });

  it("applies the guest limit: a full flare takes no one and sends no request", async () => {
    await seedUsers();
    const flare = await seedFlare({ visibility: "public", guestInviteLimit: 1 });
    await EventMember.create({
      eventId: flare.oid,
      userId: oid(FRIEND_ID),
      role: "guest",
      rsvpStatus: "going",
    });
    const token = await hostLink(flare.id);

    const res = await redeem(GUEST_ID, token);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EVENT_FULL");
    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();
    expect(await Connection.countDocuments({})).toBe(0);
  });

  it("is a 404 for someone in a block with the host, or a guest the host removed", async () => {
    await seedUsers();
    const flare = await seedFlare({ visibility: "public" });
    const token = await hostLink(flare.id);
    await Block.create({ blockerId: oid(HOST_ID), blockedId: oid(GUEST_ID) });
    await EventMember.create({
      eventId: flare.oid,
      userId: oid(FRIEND_ID),
      role: "guest",
      rsvpStatus: "invited",
      removedAt: new Date(),
    });

    expect((await redeem(GUEST_ID, token)).status).toBe(404);
    expect((await status(GUEST_ID, token)).status).toBe(404);
    expect((await redeem(FRIEND_ID, token)).status).toBe(404);
    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();
    expect((await memberRow(flare.id, FRIEND_ID))?.removedAt).toBeTruthy();
  });

  it("answers the host with their own flare and changes nothing", async () => {
    await seedUsers();
    const flare = await seedFlare({ visibility: "public" });
    const token = await hostLink(flare.id);

    const res = await redeem(HOST_ID, token);

    expect(res.body.data).toMatchObject({ state: "host", eventId: flare.id });
    expect(await Connection.countDocuments({})).toBe(0);
  });
});

describe("redeeming an invite-only flare (#616)", () => {
  it("invites a friend of the host straight away", async () => {
    await seedUsers();
    await befriend(HOST_ID, GUEST_ID);
    const flare = await seedFlare();
    const token = await hostLink(flare.id);

    const res = await redeem(GUEST_ID, token);

    expect(res.body.data).toMatchObject({ state: "invited", eventId: flare.id });
    expect(await memberRow(flare.id, GUEST_ID)).toMatchObject({
      role: "guest",
      rsvpStatus: "invited",
      invitedBy: oid(HOST_ID),
    });
    expect(
      await Notification.countDocuments({ userId: oid(GUEST_ID), type: "event_invitation" })
    ).toBe(1);
    expect(await PendingEventInvite.countDocuments({})).toBe(0);

    // And it reads as a flare they can open.
    const detail = await request(app)
      .get(`/api/v1/events/${flare.id}`)
      .set("Authorization", bearer(GUEST_ID));
    expect(detail.status).toBe(200);
  });

  it("does not open the flare to someone who is not a friend: it asks the host and waits", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);

    const res = await redeem(GUEST_ID, token);

    expect(res.status).toBe(200);
    // Waiting never learns which flare it is.
    expect(res.body.data.state).toBe("waiting");
    expect(res.body.data.eventId).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain(flare.id);
    expect(Object.keys(res.body.data.preview).sort()).toEqual([
      "endAt",
      "host",
      "placeName",
      "startAt",
      "title",
      "type",
    ]);

    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();
    expect(await PendingEventInvite.countDocuments({ eventId: flare.oid })).toBe(1);
    expect(await pendingRequestFrom(GUEST_ID)).not.toBeNull();
    expect(await acceptedRows()).toBe(0);
    const note = await Notification.findOne({
      userId: oid(HOST_ID),
      type: "connection_request",
    }).lean();
    expect(note?.title).toBe("Anna wants to join drinks at the klunkerkranich");

    const detail = await request(app)
      .get(`/api/v1/events/${flare.id}`)
      .set("Authorization", bearer(GUEST_ID));
    expect(detail.status).toBe(404);
    expect((await status(GUEST_ID, token)).body.data.state).toBe("waiting");
  });

  it("invites the guest the moment the host accepts, and tells them", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);
    await redeem(GUEST_ID, token);

    await accept();

    expect(await memberRow(flare.id, GUEST_ID)).toMatchObject({
      rsvpStatus: "invited",
      invitedBy: oid(HOST_ID),
    });
    expect(
      await Notification.countDocuments({ userId: oid(GUEST_ID), type: "event_invitation" })
    ).toBe(1);
    expect(await PendingEventInvite.countDocuments({})).toBe(0);
    const after = await status(GUEST_ID, token);
    expect(after.body.data).toMatchObject({ state: "invited", eventId: flare.id });
    const detail = await request(app)
      .get(`/api/v1/events/${flare.id}`)
      .set("Authorization", bearer(GUEST_ID));
    expect(detail.status).toBe(200);
  });

  it("invites the guest without any circle: accepting alone is enough", async () => {
    await seedUsers();
    const flare = await seedFlare({ invitedCircleIds: [new Types.ObjectId()] });
    const token = await hostLink(flare.id);
    await redeem(GUEST_ID, token);

    await accept();

    expect((await memberRow(flare.id, GUEST_ID))?.rsvpStatus).toBe("invited");
  });

  it("lapses when the host declines, and a second try does not reopen it", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);
    await redeem(GUEST_ID, token);

    const row = await pendingRequestFrom(GUEST_ID);
    await respondToConnectionRequest(HOST_ID, String(row!._id), { status: "rejected" });

    expect(await PendingEventInvite.countDocuments({})).toBe(0);
    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();

    // Trying the link again changes nothing and doesn't say why.
    const again = await redeem(GUEST_ID, token);
    expect(again.status).toBe(200);
    expect(again.body.data.state).toBe("waiting");
    expect(await PendingEventInvite.countDocuments({})).toBe(0);
    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();
    expect(await acceptedRows()).toBe(0);
  });

  it("lapses when the guest takes the request back", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);
    await redeem(GUEST_ID, token);

    const row = await pendingRequestFrom(GUEST_ID);
    await deleteConnection(GUEST_ID, String(row!._id));

    expect(await PendingEventInvite.countDocuments({})).toBe(0);
    expect((await status(GUEST_ID, token)).body.data.state).toBe("none");
  });

  it("grants nothing if the flare ended before the host accepted", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);
    await redeem(GUEST_ID, token);
    await Event.updateOne({ _id: flare.oid }, { $set: { endAt: new Date(Date.now() - 1000) } });

    await accept();

    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();
    expect(await Notification.countDocuments({ type: "event_invitation" })).toBe(0);
    expect(await PendingEventInvite.countDocuments({})).toBe(0);
    // They are friends now, which is the host's call, but not on the flare.
    expect(await acceptedRows()).toBe(2);
  });

  it("lapses when the host cancels the flare", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);
    await redeem(GUEST_ID, token);

    await cancelEvent(HOST_ID, flare.id);
    expect(await PendingEventInvite.countDocuments({})).toBe(0);

    await accept();
    expect(await memberRow(flare.id, GUEST_ID)).toBeNull();
    expect((await status(GUEST_ID, token)).status).toBe(404);
  });

  it("grants when the two connect another way (a QR scan), too", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);
    await redeem(GUEST_ID, token);

    await connectInPerson(GUEST_ID, HOST_ID);

    expect((await memberRow(flare.id, GUEST_ID))?.rsvpStatus).toBe("invited");
    expect(await PendingEventInvite.countDocuments({})).toBe(0);
  });

  it("invites at once when the host had already asked the guest to connect", async () => {
    await seedUsers();
    await Connection.create({
      requesterId: oid(HOST_ID),
      receiverId: oid(GUEST_ID),
      status: "pending",
      type: "qr",
    });
    const flare = await seedFlare();
    const token = await hostLink(flare.id);

    const res = await redeem(GUEST_ID, token);

    expect(res.body.data).toMatchObject({ state: "invited", eventId: flare.id });
    expect((await memberRow(flare.id, GUEST_ID))?.rsvpStatus).toBe("invited");
  });

  it("is safe to tap twice: one request, one wait", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);

    await redeem(GUEST_ID, token);
    const second = await redeem(GUEST_ID, token);

    expect(second.body.data.state).toBe("waiting");
    expect(await PendingEventInvite.countDocuments({})).toBe(1);
    expect(await Connection.countDocuments({ status: "pending" })).toBe(1);
    expect(await Notification.countDocuments({ type: "connection_request" })).toBe(1);
  });

  it("does not undo a removal: a removed guest's link still 404s after they connect", async () => {
    await seedUsers();
    await befriend(HOST_ID, GUEST_ID);
    const flare = await seedFlare();
    await EventMember.create({
      eventId: flare.oid,
      userId: oid(GUEST_ID),
      role: "guest",
      rsvpStatus: "invited",
      removedAt: new Date(),
    });
    const token = await hostLink(flare.id);

    expect((await redeem(GUEST_ID, token)).status).toBe(404);
    expect((await memberRow(flare.id, GUEST_ID))?.removedAt).toBeTruthy();
  });

  it("status changes nothing", async () => {
    await seedUsers();
    const flare = await seedFlare();
    const token = await hostLink(flare.id);

    const res = await status(GUEST_ID, token);

    expect(res.body.data.state).toBe("none");
    expect(res.body.data.eventId).toBeNull();
    expect(await Connection.countDocuments({})).toBe(0);
    expect(await PendingEventInvite.countDocuments({})).toBe(0);
    expect(await Notification.countDocuments({})).toBe(0);
  });
});
