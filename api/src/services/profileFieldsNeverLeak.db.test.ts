import type { Express } from "express";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as models from "#models/index";
import { getUsersByIds, searchUsers, userProjection } from "#services/userDirectoryService";

// #288 regression: bio, social handles and mutual friends are profile-only.
// They are read by userProfileService alone, behind the #166 visibility
// table. Every other path that shows another user (search, flares via
// attachEventPeople, connections, inbox, blocks, notifications, circles, QR
// codes and invite links) goes through `userProjection` / `getUsersByIds` or
// its own projection, and must never carry them: those payloads reach
// strangers (anyone who can see a public flare sees its host and guests).
//
// Both users here have every profile field filled with a marker string. The
// test walks the whole core loop over HTTP, as both of them, and checks that
// no response outside the profile endpoint contains a marker or a profile-only
// key.

const JWT_SECRET = "test-secret";

const LENA_ID = new Types.ObjectId();
const MAX_ID = new Types.ObjectId();

const MARKERS = [
  "bio-marker-lena",
  "ig_marker_lena",
  "tg_marker_lena",
  "bio-marker-max",
  "ig_marker_max",
  "tg_marker_max",
];
const PROFILE_ONLY_KEYS = ["bio", "instagram", "telegram", "socials", "mutualFriends"];
const IDENTITY_FIELDS = [
  "_id",
  "avatarUrl",
  "displayName",
  "profileVisibility",
  "socialBattery",
  "username",
];

let mongoServer: MongoMemoryReplSet;
let app: Express;

const users = () => mongoose.connection.db!.collection("users");

const tokenFor = (userId: Types.ObjectId) =>
  jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: "5m" });

const as = (userId: Types.ObjectId) => {
  const auth = { Authorization: `Bearer ${tokenFor(userId)}` };
  return {
    get: (path: string) => request(app).get(`/api/v1${path}`).set(auth),
    post: (path: string, body: object = {}) =>
      request(app).post(`/api/v1${path}`).set(auth).send(body),
    patch: (path: string, body: object = {}) =>
      request(app).patch(`/api/v1${path}`).set(auth).send(body),
  };
};

const collectKeys = (value: unknown, keys = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
};

// Every response checked, labelled, so a failure names the endpoint.
const checked: string[] = [];

const expectNoProfileFields = (label: string, body: unknown) => {
  checked.push(label);
  const raw = JSON.stringify(body);
  for (const marker of MARKERS) {
    expect(raw, `${label} leaked "${marker}"`).not.toContain(marker);
  }
  const keys = collectKeys(body);
  for (const key of PROFILE_ONLY_KEYS) {
    expect(keys.has(key), `${label} carries a "${key}" key`).toBe(false);
  }
};

const insertUser = (_id: Types.ObjectId, name: string) =>
  users().insertOne({
    _id,
    username: name,
    displayName: `${name} display`,
    email: `${name}@example.com`,
    avatarUrl: `https://example.com/${name}.png`,
    profileVisibility: "public",
    socialBattery: 50,
    bio: `bio-marker-${name}`,
    instagram: `ig_marker_${name}`,
    telegram: `tg_marker_${name}`,
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = "mongodb://localhost:27017";
  process.env.DB_NAME = "sponti_api_test";
  process.env.CLIENT_BASE_URL = "http://localhost:3000/";
  process.env.ACCESS_JWT_SECRET = JWT_SECRET;
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_profile_leak_test" });
  await Promise.all(
    Object.values(models)
      .filter(
        (model): model is mongoose.Model<any> =>
          typeof model === "function" && "syncIndexes" in model
      )
      .map((model) => model.syncIndexes())
  );

  const module = await import("#app");
  app = module.createApp();

  await Promise.all([insertUser(LENA_ID, "lena"), insertUser(MAX_ID, "max")]);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

describe("profile-only fields never leave the profile endpoint (#288)", () => {
  it("userProjection selects identity fields only", () => {
    expect(Object.keys(userProjection).sort()).toEqual(
      IDENTITY_FIELDS.filter((key) => key !== "_id").sort()
    );
  });

  it("getUsersByIds and searchUsers return identity fields only", async () => {
    const byId = await getUsersByIds([LENA_ID.toString(), MAX_ID.toString()]);
    const found = await searchUsers(MAX_ID.toString(), { q: "lena", limit: 20 });

    expect(byId.size).toBe(2);
    expect(found).toHaveLength(1);
    for (const summary of [...byId.values(), ...found]) {
      for (const key of Object.keys(summary)) {
        expect(IDENTITY_FIELDS).toContain(key);
      }
    }
    expectNoProfileFields("getUsersByIds", Array.from(byId.values()));
    expectNoProfileFields("searchUsers", found);
  });

  it("the core loop, as both people, over HTTP", async () => {
    const lena = as(LENA_ID);
    const max = as(MAX_ID);
    const soon = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

    // Search.
    expectNoProfileFields(
      "GET /users/search",
      (await max.get("/users/search?q=lena").expect(200)).body
    );

    // QR code and invite link, before they are connected.
    const qr = await lena.post("/qr-contact-tokens").expect(201);
    expectNoProfileFields(
      "POST /qr-contact-tokens/resolve",
      (await max.post("/qr-contact-tokens/resolve", { token: qr.body.data.token }).expect(200)).body
    );
    const invite = await lena.get("/invite-links/me").expect(200);
    expectNoProfileFields(
      "POST /invite-links/resolve",
      (await max.post("/invite-links/resolve", { token: invite.body.data.token }).expect(200)).body
    );
    expectNoProfileFields(
      "POST /public/contact-preview",
      (
        await request(app)
          .post("/api/v1/public/contact-preview")
          .send({ kind: "invite", token: invite.body.data.token })
          .expect(200)
      ).body
    );

    // Max asks, Lena sees the request in her inbox and notifications, accepts.
    await max.post("/connections/request", { receiverId: LENA_ID.toString() }).expect(202);
    const inbox = await lena.get("/inbox/me").expect(200);
    expectNoProfileFields("GET /inbox/me", inbox.body);
    expectNoProfileFields(
      "GET /notifications (request)",
      (await lena.get("/notifications").expect(200)).body
    );
    const requestId = inbox.body.data.connectionRequests[0]._id;
    expectNoProfileFields(
      "PATCH /connections/:id/respond",
      (await lena.patch(`/connections/${requestId}/respond`, { status: "accepted" }).expect(200))
        .body
    );
    expectNoProfileFields(
      "GET /notifications (accepted)",
      (await max.get("/notifications").expect(200)).body
    );
    expectNoProfileFields(
      "GET /connections (lena)",
      (await lena.get("/connections").expect(200)).body
    );
    expectNoProfileFields(
      "GET /connections (max)",
      (await max.get("/connections").expect(200)).body
    );

    // Circles.
    const circle = await lena
      .post("/circles", { name: "climbers", memberIds: [MAX_ID.toString()] })
      .expect(201);
    expectNoProfileFields("POST /circles", circle.body);
    expectNoProfileFields("GET /circles", (await lena.get("/circles").expect(200)).body);

    // A public flare with Max invited: host and guests via attachEventPeople.
    const created = await lena
      .post("/events", {
        title: "bouldering",
        startAt: soon(30),
        endAt: soon(150),
        locationName: "the wall",
        location: { type: "Point", coordinates: [13.4, 52.52] },
        visibility: "public",
        members: [{ userId: MAX_ID.toString() }],
      })
      .expect(201);
    expectNoProfileFields("POST /events", created.body);
    const eventId = created.body.data.event._id;

    expectNoProfileFields("GET /inbox/me (invite)", (await max.get("/inbox/me").expect(200)).body);
    expectNoProfileFields(
      "GET /notifications (invite)",
      (await max.get("/notifications").expect(200)).body
    );
    expectNoProfileFields(
      "PATCH /events/:id/me",
      (
        await max
          .patch(`/events/${eventId}/me`, { rsvpStatus: "going", memberWillArriveAt: soon(40) })
          .expect(200)
      ).body
    );
    expectNoProfileFields(
      "GET /notifications (rsvp)",
      (await lena.get("/notifications").expect(200)).body
    );

    for (const [who, client] of [
      ["lena", lena],
      ["max", max],
    ] as const) {
      expectNoProfileFields(
        `GET /events/:id (${who})`,
        (await client.get(`/events/${eventId}`).expect(200)).body
      );
      expectNoProfileFields(
        `GET /events/map/active (${who})`,
        (await client.get("/events/map/active?lat=52.52&lng=13.4&radiusKm=10").expect(200)).body
      );
      expectNoProfileFields(
        `GET /events/calendar/upcoming (${who})`,
        (await client.get("/events/calendar/upcoming").expect(200)).body
      );
      expectNoProfileFields(
        `GET /events/mine/upcoming (${who})`,
        (await client.get("/events/mine/upcoming").expect(200)).body
      );
      expectNoProfileFields(`GET /events (${who})`, (await client.get("/events").expect(200)).body);
    }
    expectNoProfileFields(
      "GET /events/:id/members",
      (await lena.get(`/events/${eventId}/members`).expect(200)).body
    );
    expectNoProfileFields(
      "GET /circles/:id/events",
      (await lena.get(`/circles/${circle.body.data._id}/events`).expect(200)).body
    );

    // The flare's thread.
    expectNoProfileFields(
      "POST /events/:id/updates",
      (await lena.post(`/events/${eventId}/updates`, { body: "running late" }).expect(201)).body
    );
    expectNoProfileFields(
      "GET /events/:id/updates",
      (await max.get(`/events/${eventId}/updates`).expect(200)).body
    );
    expectNoProfileFields(
      "GET /notifications (update)",
      (await max.get("/notifications").expect(200)).body
    );

    // Sanity: the profile endpoint itself does carry them, so the markers work.
    const profile = await lena.get("/users/by-username/max").expect(200);
    expect(profile.body.data.profile.bio).toBe("bio-marker-max");

    // Blocks.
    expectNoProfileFields(
      "POST /blocks/:userId",
      (await max.post(`/blocks/${LENA_ID}`).expect(201)).body
    );
    expectNoProfileFields("GET /blocks", (await max.get("/blocks").expect(200)).body);

    expect(checked.length).toBeGreaterThan(30);
  });
});
