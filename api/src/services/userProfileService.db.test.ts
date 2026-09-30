import type { Express } from "express";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Block, Connection } from "#models/index";

// GET /users/by-username/:username (#199), end to end against an in-memory
// Mongo: the privacy matrix for someone else's profile. Profile visibility is
// discovery-only, so a stranger sees the same public identity for a public or
// a private user, and nothing beyond display name, @username and avatar.

const JWT_SECRET = "test-secret";
const VIEWER_ID = new Types.ObjectId();
const HOST_ID = new Types.ObjectId();

const PUBLIC_IDENTITY_KEYS = ["avatarUrl", "displayName", "id", "username"];

let mongoServer: MongoMemoryReplSet;
let app: Express;

const users = () => mongoose.connection.db!.collection("users");

const tokenFor = (userId: Types.ObjectId) =>
  jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: "5m" });

const getProfile = (username: string, viewer = VIEWER_ID) =>
  request(app)
    .get(`/api/v1/users/by-username/${username}`)
    .set("Authorization", `Bearer ${tokenFor(viewer)}`);

const insertHost = (overrides: Record<string, unknown> = {}) =>
  users().insertOne({
    _id: HOST_ID,
    username: "sarah",
    displayName: "Sarah Kim",
    email: "sarah@example.com",
    passwordHash: "not-a-real-hash",
    avatarUrl: "https://example.com/sarah.png",
    avatarPublicId: "avatars/sarah",
    googleId: "google-sarah",
    profileVisibility: "public",
    socialBattery: 80,
    ...overrides,
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  // Same test-only config app.test.ts uses; the app never connects with it,
  // this file connects mongoose to the in-memory server itself.
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = "mongodb://localhost:27017";
  process.env.DB_NAME = "sponti_api_test";
  process.env.CLIENT_BASE_URL = "http://localhost:3000/";
  process.env.ACCESS_JWT_SECRET = JWT_SECRET;
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_user_profile_test" });
  await Promise.all([Block.syncIndexes(), Connection.syncIndexes()]);

  const module = await import("#app");
  app = module.createApp();
}, 120_000);

afterEach(async () => {
  await Promise.all([users().deleteMany({}), Block.deleteMany({}), Connection.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

describe("GET /users/by-username/:username", () => {
  it("shows a stranger a public user's name, @username and avatar, and nothing else", async () => {
    await insertHost();

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toEqual({
      profile: {
        id: HOST_ID.toString(),
        username: "sarah",
        displayName: "Sarah Kim",
        avatarUrl: "https://example.com/sarah.png",
      },
      relationship: "none",
      connectionId: null,
    });
    expect(Object.keys(res.body.data.profile).sort()).toEqual(PUBLIC_IDENTITY_KEYS);
  });

  it("shows a stranger the same public identity for a private user (visibility is discovery-only)", async () => {
    await insertHost({ profileVisibility: "private" });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data.relationship).toBe("none");
    expect(Object.keys(res.body.data.profile).sort()).toEqual(PUBLIC_IDENTITY_KEYS);
    // Nothing in the payload says the account is private.
    expect(JSON.stringify(res.body)).not.toContain("private");
  });

  it("never sends email, visibility, social battery or credentials", async () => {
    await insertHost();

    const res = await getProfile("sarah").expect(200);
    const raw = JSON.stringify(res.body);

    for (const leaked of [
      "sarah@example.com",
      "not-a-real-hash",
      "google-sarah",
      "avatars/sarah",
      "socialBattery",
      "profileVisibility",
      "email",
    ]) {
      expect(raw).not.toContain(leaked);
    }
  });

  it("marks an accepted connection (a row each way) as connected", async () => {
    await insertHost({ profileVisibility: "private" });
    await Connection.create([
      {
        requesterId: HOST_ID,
        receiverId: VIEWER_ID,
        status: "accepted",
        type: "shared_invitation",
      },
      {
        requesterId: VIEWER_ID,
        receiverId: HOST_ID,
        status: "accepted",
        type: "shared_invitation",
      },
    ]);

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toMatchObject({ relationship: "connected", connectionId: null });
    expect(Object.keys(res.body.data.profile).sort()).toEqual(PUBLIC_IDENTITY_KEYS);
  });

  it("does not count a one-sided accepted row as connected, in either direction (#260)", async () => {
    await insertHost();

    for (const [requesterId, receiverId] of [
      [HOST_ID, VIEWER_ID],
      [VIEWER_ID, HOST_ID],
    ]) {
      await Connection.deleteMany({});
      await Connection.create({
        requesterId,
        receiverId,
        status: "accepted",
        type: "shared_invitation",
      });

      const res = await getProfile("sarah").expect(200);

      expect(res.body.data).toMatchObject({ relationship: "none", connectionId: null });
    }
  });

  it("returns the pending request id for a request the viewer sent, so they can cancel it", async () => {
    await insertHost();
    const pending = await Connection.create({
      requesterId: VIEWER_ID,
      receiverId: HOST_ID,
      status: "pending",
      type: "shared_invitation",
    });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toMatchObject({
      relationship: "pending_outgoing",
      connectionId: pending._id.toString(),
    });
  });

  it("returns the pending request id for a request the viewer received, so they can accept it", async () => {
    await insertHost();
    const pending = await Connection.create({
      requesterId: HOST_ID,
      receiverId: VIEWER_ID,
      status: "pending",
      type: "shared_invitation",
    });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toMatchObject({
      relationship: "pending_incoming",
      connectionId: pending._id.toString(),
    });
  });

  it("does not tell the viewer their request was rejected", async () => {
    await insertHost();
    await Connection.create({
      requesterId: VIEWER_ID,
      receiverId: HOST_ID,
      status: "rejected",
      type: "shared_invitation",
    });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toMatchObject({ relationship: "none", connectionId: null });
  });

  it("lets a viewer who blocked someone still open them, to unblock", async () => {
    await insertHost();
    await Block.create({ blockerId: VIEWER_ID, blockedId: HOST_ID });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toMatchObject({
      profile: { id: HOST_ID.toString(), username: "sarah" },
      relationship: "blocked",
      connectionId: null,
    });
  });

  it("answers a viewer the user blocked exactly like an unknown username", async () => {
    await insertHost();
    await Block.create({ blockerId: HOST_ID, blockedId: VIEWER_ID });
    // Even a leftover accepted connection row doesn't get them through.
    await Connection.create({
      requesterId: VIEWER_ID,
      receiverId: HOST_ID,
      status: "accepted",
      type: "shared_invitation",
    });

    const blocked = await getProfile("sarah").expect(404);
    const unknown = await getProfile("nobody-here").expect(404);

    expect(blocked.body).toEqual(unknown.body);
    expect(blocked.body.error.code).toBe("USER_NOT_FOUND");
    expect(JSON.stringify(blocked.body)).not.toContain("Sarah");
  });

  it("treats a block both ways as the viewer's own block", async () => {
    await insertHost();
    await Block.create({ blockerId: HOST_ID, blockedId: VIEWER_ID });
    await Block.create({ blockerId: VIEWER_ID, blockedId: HOST_ID });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data.relationship).toBe("blocked");
  });

  it("recognises the viewer's own profile", async () => {
    await insertHost();

    const res = await getProfile("sarah", HOST_ID).expect(200);

    expect(res.body.data).toMatchObject({ relationship: "self", connectionId: null });
  });

  it("matches the stored username exactly", async () => {
    await insertHost();

    await getProfile("Sarah").expect(404);
    await getProfile("sar").expect(404);
  });

  it("falls back to the username when there is no display name", async () => {
    await insertHost({ displayName: "", avatarUrl: null });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data.profile).toMatchObject({ displayName: "sarah", avatarUrl: null });
  });

  it("rejects a malformed username without looking it up", async () => {
    const res = await getProfile("sarah%24ne").expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires a signed-in viewer", async () => {
    await insertHost();

    await request(app).get("/api/v1/users/by-username/sarah").expect(401);
  });
});
