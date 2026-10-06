import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Block, Connection, InviteLink, Notification, QrContactToken } from "#models/index";
import { getContactPreview } from "#services/contactPreviewService";
import { connectInPerson } from "#services/connectionService";
import {
  INVITE_LINK_TTL_MS,
  getMyInviteLink,
  resetMyInviteLink,
  resolveInviteLink,
} from "#services/inviteLinkService";
import {
  QR_EXPIRED_REQUEST_GRACE_MS,
  createQrContactToken,
  resolveQrContactToken,
} from "#services/qrContactTokenService";

// #124: first-friend flows against a real (in-memory) Mongo — instant QR
// connect, the 7-day invite link, and the unauthenticated sign-up preview.

const OWNER_ID = new Types.ObjectId().toString();
const VIEWER_ID = new Types.ObjectId().toString();
const OTHER_ID = new Types.ObjectId().toString();
const JWT_SECRET = "contact-links-test-secret";

let mongoServer: MongoMemoryReplSet;
let app: Express;

const oid = (id: string) => new Types.ObjectId(id);

const usersCollection = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("not connected");
  return db.collection("users");
};

const connectionRows = () =>
  Connection.find({
    $or: [
      { requesterId: oid(VIEWER_ID), receiverId: oid(OWNER_ID) },
      { requesterId: oid(OWNER_ID), receiverId: oid(VIEWER_ID) },
    ],
  }).lean();

const bearer = (userId: string) => `Bearer ${jwt.sign({ userId }, JWT_SECRET)}`;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_contact_links_test" });
  await Promise.all([
    Connection.syncIndexes(),
    InviteLink.syncIndexes(),
    QrContactToken.syncIndexes(),
    Notification.syncIndexes(),
    Block.syncIndexes(),
  ]);

  // The app only ever talks to the in-memory server: mongoose is already
  // connected, so connectDB() reuses this connection.
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.DB_NAME = "sponti_contact_links_test";
  process.env.CLIENT_BASE_URL = "http://localhost:3000";
  process.env.ACCESS_JWT_SECRET = JWT_SECRET;
  app = (await import("#app")).createApp();
}, 120_000);

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all([
    Connection.deleteMany({}),
    InviteLink.deleteMany({}),
    QrContactToken.deleteMany({}),
    Notification.deleteMany({}),
    Block.deleteMany({}),
    usersCollection().deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const seedUsers = () =>
  usersCollection().insertMany([
    {
      _id: oid(OWNER_ID),
      username: "alex",
      displayName: "Alex Kim",
      email: "alex@example.com",
      avatarUrl: "https://example.com/a.png",
      profileVisibility: "private",
    },
    { _id: oid(VIEWER_ID), username: "sam", displayName: "Sam", email: "sam@example.com" },
    { _id: oid(OTHER_ID), username: "jo", displayName: "Jo", email: "jo@example.com" },
  ]);

describe("QR scan connects instantly (#124)", () => {
  it("connects both people on scan and tells the owner", async () => {
    await seedUsers();
    const { token } = await createQrContactToken(OWNER_ID);

    const result = await resolveQrContactToken(VIEWER_ID, { token, connect: true });

    expect(result.relationship).toBe("connected");
    expect(result.connection).toEqual({ processed: true, delivered: true, autoAccepted: true });
    const rows = await connectionRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "accepted" && row.type === "qr")).toBe(true);

    const notifications = await Notification.find({ userId: oid(OWNER_ID) }).lean();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "connection_accepted",
      title: "Sam scanned your QR code",
    });
    // The scanner is not notified about their own action.
    expect(await Notification.countDocuments({ userId: oid(VIEWER_ID) })).toBe(0);
  });

  it("does not connect when either user has blocked the other", async () => {
    await seedUsers();
    await Block.create({ blockerId: oid(OWNER_ID), blockedId: oid(VIEWER_ID) });
    const { token } = await createQrContactToken(OWNER_ID);

    await expect(resolveQrContactToken(VIEWER_ID, { token, connect: true })).rejects.toMatchObject({
      statusCode: 404,
      code: "QR_CONTACT_TOKEN_NOT_FOUND",
    });
    // And the lower-level helper is a silent no-op on its own, too.
    await expect(connectInPerson(VIEWER_ID, OWNER_ID)).resolves.toMatchObject({
      delivered: false,
      connected: false,
    });
    expect(await connectionRows()).toHaveLength(0);
    expect(await Notification.countDocuments({})).toBe(0);
  });

  it("is a no-op when scanning your own code", async () => {
    await seedUsers();
    const { token } = await createQrContactToken(OWNER_ID);

    const result = await resolveQrContactToken(OWNER_ID, { token, connect: true });

    expect(result.relationship).toBe("self");
    expect(result.connection).toBeNull();
    expect(await Connection.countDocuments({})).toBe(0);
    await expect(connectInPerson(OWNER_ID, OWNER_ID)).rejects.toMatchObject({
      code: "CANNOT_CONNECT_SELF",
    });
  });

  it("is a no-op when already connected", async () => {
    await seedUsers();
    await Connection.create([
      {
        requesterId: oid(VIEWER_ID),
        receiverId: oid(OWNER_ID),
        status: "accepted",
        type: "shared_invitation",
      },
      {
        requesterId: oid(OWNER_ID),
        receiverId: oid(VIEWER_ID),
        status: "accepted",
        type: "shared_invitation",
      },
    ]);
    const { token } = await createQrContactToken(OWNER_ID);

    const result = await resolveQrContactToken(VIEWER_ID, { token, connect: true });

    expect(result.relationship).toBe("connected");
    expect(result.canConnect).toBe(false);
    expect(result.connection).toBeNull();
    expect(await Notification.countDocuments({})).toBe(0);
  });

  it.each([
    ["the scanner's own pending request", VIEWER_ID, OWNER_ID],
    ["the owner's pending request to the scanner", OWNER_ID, VIEWER_ID],
  ])("resolves %s into a connection", async (_label, requesterId, receiverId) => {
    await seedUsers();
    await Connection.create({
      requesterId: oid(requesterId),
      receiverId: oid(receiverId),
      status: "pending",
      type: "shared_invitation",
    });
    const { token } = await createQrContactToken(OWNER_ID);

    const result = await resolveQrContactToken(VIEWER_ID, { token, connect: true });

    expect(result.relationship).toBe("connected");
    const rows = await connectionRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "accepted")).toBe(true);
    // The pre-existing row keeps its original type.
    expect(rows.find((row) => row.requesterId.toString() === requesterId)?.type).toBe(
      "shared_invitation"
    );
  });

  it("rejects a QR code expired past the grace window and makes no connection", async () => {
    await seedUsers();
    const { token } = await createQrContactToken(OWNER_ID);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 15 * 60 * 1000 + QR_EXPIRED_REQUEST_GRACE_MS + 1000);

    await expect(resolveQrContactToken(VIEWER_ID, { token, connect: true })).rejects.toMatchObject({
      statusCode: 410,
      code: "QR_CONTACT_TOKEN_EXPIRED",
    });
    expect(await Connection.countDocuments({})).toBe(0);
    // Dead for good: the next try reads like a code that never existed.
    await expect(resolveQrContactToken(VIEWER_ID, { token, connect: true })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  describe("just expired, e.g. during a slow sign-up (#441)", () => {
    const expireBy = (ms: number) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 15 * 60 * 1000 + ms);
    };

    it("names the owner and offers a request, flagged as expired", async () => {
      await seedUsers();
      const { token } = await createQrContactToken(OWNER_ID);
      expireBy(30 * 60 * 1000);

      const result = await resolveQrContactToken(VIEWER_ID, { token, connect: false });

      expect(result).toMatchObject({
        expired: true,
        relationship: "none",
        canConnect: true,
        profile: { username: "alex", displayName: "Alex Kim" },
        connection: null,
      });
      expect(await Connection.countDocuments({})).toBe(0);
    });

    it("sends a friend request, never an instant connection", async () => {
      await seedUsers();
      const { token } = await createQrContactToken(OWNER_ID);
      expireBy(30 * 60 * 1000);

      const result = await resolveQrContactToken(VIEWER_ID, { token, connect: true });

      expect(result.relationship).toBe("pending_outgoing");
      expect(result.canConnect).toBe(false);
      expect(result.connection).toMatchObject({ processed: true, delivered: true });
      const rows = await connectionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "pending", type: "shared_invitation" });
      expect(await Notification.findOne({ userId: oid(OWNER_ID) }).lean()).toMatchObject({
        type: "connection_request",
      });
    });

    it("accepts the owner's request to the viewer", async () => {
      await seedUsers();
      await Connection.create({
        requesterId: oid(OWNER_ID),
        receiverId: oid(VIEWER_ID),
        status: "pending",
        type: "shared_invitation",
      });
      const { token } = await createQrContactToken(OWNER_ID);
      expireBy(30 * 60 * 1000);

      const result = await resolveQrContactToken(VIEWER_ID, { token, connect: true });

      expect(result.relationship).toBe("connected");
    });

    it("keeps working on repeat tries inside the window", async () => {
      await seedUsers();
      const { token } = await createQrContactToken(OWNER_ID);
      expireBy(30 * 60 * 1000);

      await resolveQrContactToken(VIEWER_ID, { token, connect: false });
      await expect(
        resolveQrContactToken(VIEWER_ID, { token, connect: false })
      ).resolves.toMatchObject({ expired: true });
    });

    it("does not resend a pending request or reveal a block", async () => {
      await seedUsers();
      const { token } = await createQrContactToken(OWNER_ID);
      expireBy(30 * 60 * 1000);

      await resolveQrContactToken(VIEWER_ID, { token, connect: true });
      const again = await resolveQrContactToken(VIEWER_ID, { token, connect: true });
      expect(again).toMatchObject({ relationship: "pending_outgoing", canConnect: false });
      expect(await Connection.countDocuments({})).toBe(1);

      await Connection.deleteMany({});
      await Block.create({ blockerId: oid(OWNER_ID), blockedId: oid(VIEWER_ID) });
      await expect(
        resolveQrContactToken(VIEWER_ID, { token, connect: true })
      ).rejects.toMatchObject({ statusCode: 404, code: "QR_CONTACT_TOKEN_NOT_FOUND" });
      expect(await Connection.countDocuments({})).toBe(0);
    });

    it("marks a live code as not expired", async () => {
      await seedUsers();
      const { token } = await createQrContactToken(OWNER_ID);

      await expect(
        resolveQrContactToken(VIEWER_ID, { token, connect: false })
      ).resolves.toMatchObject({ expired: false });
    });
  });
});

describe("invite link (#124)", () => {
  it("returns the same live link until it is reset, valid for 7 days", async () => {
    const before = Date.now();
    const first = await getMyInviteLink(OWNER_ID);
    const again = await getMyInviteLink(OWNER_ID);

    expect(again.token).toBe(first.token);
    expect(first.expiresAt.getTime()).toBeGreaterThanOrEqual(before + INVITE_LINK_TTL_MS);
    expect(first.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + INVITE_LINK_TTL_MS);
  });

  it("sends a connection request (not a connection) and notifies the owner", async () => {
    await seedUsers();
    const { token } = await getMyInviteLink(OWNER_ID);

    const preview = await resolveInviteLink(VIEWER_ID, { token, connect: false });
    expect(preview).toMatchObject({ relationship: "none", canConnect: true, connection: null });
    expect(await Connection.countDocuments({})).toBe(0);

    const result = await resolveInviteLink(VIEWER_ID, { token, connect: true });

    expect(result.relationship).toBe("pending_outgoing");
    expect(result.canConnect).toBe(false);
    const rows = await connectionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", type: "shared_invitation" });
    expect(await Notification.findOne({ userId: oid(OWNER_ID) }).lean()).toMatchObject({
      type: "connection_request",
    });
  });

  it("works for many people", async () => {
    await seedUsers();
    const { token } = await getMyInviteLink(OWNER_ID);

    await resolveInviteLink(VIEWER_ID, { token, connect: true });
    await resolveInviteLink(OTHER_ID, { token, connect: true });

    expect(await Connection.countDocuments({ receiverId: oid(OWNER_ID), status: "pending" })).toBe(
      2
    );
  });

  it("hides the owner from blocked viewers and sends nothing", async () => {
    await seedUsers();
    await Block.create({ blockerId: oid(VIEWER_ID), blockedId: oid(OWNER_ID) });
    const { token } = await getMyInviteLink(OWNER_ID);

    await expect(resolveInviteLink(VIEWER_ID, { token, connect: true })).rejects.toMatchObject({
      statusCode: 404,
      code: "INVITE_LINK_NOT_FOUND",
    });
    expect(await Connection.countDocuments({})).toBe(0);
  });

  it("does nothing when the owner opens their own link", async () => {
    await seedUsers();
    const { token } = await getMyInviteLink(OWNER_ID);

    const result = await resolveInviteLink(OWNER_ID, { token, connect: true });

    expect(result).toMatchObject({ relationship: "self", canConnect: false, connection: null });
    expect(await Connection.countDocuments({})).toBe(0);
  });

  it("revokes the old link on reset and issues a new one", async () => {
    await seedUsers();
    const old = await getMyInviteLink(OWNER_ID);
    const fresh = await resetMyInviteLink(OWNER_ID);

    expect(fresh.token).not.toBe(old.token);
    expect((await getMyInviteLink(OWNER_ID)).token).toBe(fresh.token);
    await expect(
      resolveInviteLink(VIEWER_ID, { token: old.token, connect: true })
    ).rejects.toMatchObject({ statusCode: 404, code: "INVITE_LINK_NOT_FOUND" });
    expect(await Connection.countDocuments({})).toBe(0);
    await expect(
      resolveInviteLink(VIEWER_ID, { token: fresh.token, connect: false })
    ).resolves.toMatchObject({ relationship: "none" });
  });

  it("rejects an expired link and issues a new one to its owner", async () => {
    await seedUsers();
    const old = await getMyInviteLink(OWNER_ID);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + INVITE_LINK_TTL_MS + 1000);

    await expect(
      resolveInviteLink(VIEWER_ID, { token: old.token, connect: true })
    ).rejects.toMatchObject({ statusCode: 410, code: "INVITE_LINK_EXPIRED" });
    expect(await Connection.countDocuments({})).toBe(0);
    expect((await getMyInviteLink(OWNER_ID)).token).not.toBe(old.token);
  });
});

describe("unauthenticated contact preview (#124)", () => {
  it("returns only the display name for a live QR code or invite link", async () => {
    await seedUsers();
    const qr = await createQrContactToken(OWNER_ID);
    const invite = await getMyInviteLink(OWNER_ID);

    // No Authorization header, and the owner's profile is private: sharing
    // your own link is what makes your display name visible here.
    for (const body of [
      { kind: "qr", token: qr.token },
      { kind: "invite", token: invite.token },
    ]) {
      const response = await request(app)
        .post("/api/v1/public/contact-preview")
        .send(body)
        .expect(200);

      expect(response.body).toEqual({ data: { displayName: "Alex Kim" } });
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("gives the same generic 404 for unknown, cross-kind, revoked and expired tokens", async () => {
    await seedUsers();
    const qr = await createQrContactToken(OWNER_ID);
    const revoked = await getMyInviteLink(OWNER_ID);
    await resetMyInviteLink(OWNER_ID);

    const cases = [
      { kind: "invite", token: "does-not-exist" },
      { kind: "invite", token: qr.token },
      { kind: "qr", token: revoked.token },
      { kind: "invite", token: revoked.token },
    ];

    for (const body of cases) {
      const response = await request(app)
        .post("/api/v1/public/contact-preview")
        .send(body)
        .expect(404);
      expect(response.body.error.code).toBe("CONTACT_PREVIEW_NOT_FOUND");
      expect(JSON.stringify(response.body)).not.toContain("Alex");
    }

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    await expect(getContactPreview({ kind: "qr", token: qr.token })).rejects.toMatchObject({
      statusCode: 404,
      code: "CONTACT_PREVIEW_NOT_FOUND",
    });
  });

  it("rejects malformed input and extra fields", async () => {
    await request(app)
      .post("/api/v1/public/contact-preview")
      .send({ kind: "invite", token: "../../etc" })
      .expect(400);
    await request(app)
      .post("/api/v1/public/contact-preview")
      .send({ kind: "invite", token: "abc", userId: OWNER_ID })
      .expect(400);
  });

  it("does not open up any other /api/v1 route", async () => {
    await request(app).post("/api/v1/public/anything-else").send({}).expect(401);
    await request(app).get("/api/v1/invite-links/me").expect(401);
    await request(app).post("/api/v1/qr-contact-tokens/resolve").send({ token: "x" }).expect(401);
  });

  it("serves the invite-link routes to signed-in users", async () => {
    await seedUsers();
    const response = await request(app)
      .get("/api/v1/invite-links/me")
      .set("Authorization", bearer(OWNER_ID))
      .expect(200);

    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data).not.toHaveProperty("userId");
  });

  // Keep this last: the limiter counts per address for the whole test file.
  it("is rate-limited (#450)", async () => {
    let limited: request.Response | undefined;

    for (let i = 0; i < 70 && !limited; i += 1) {
      const response = await request(app)
        .post("/api/v1/public/contact-preview")
        .send({ kind: "invite", token: "does-not-exist" });
      if (response.status === 429) limited = response;
    }

    expect(limited?.body.error.code).toBe("RATE_LIMITED");
    expect(limited?.headers["retry-after"]).toBeDefined();
  });
});
