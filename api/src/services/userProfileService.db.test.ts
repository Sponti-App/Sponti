import type { Express } from "express";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Block, Connection } from "#models/index";

// GET /users/by-username/:username (#199, #288) and its mutual friends list,
// end to end against an in-memory Mongo: the visibility table from #166.
//
// | viewer                       | public profile       | private profile        |
// | self                         | everything           | everything             |
// | connection                   | identity, bio,       | the same               |
// |                              | socials, mutuals     |                        |
// | signed-in stranger           | the same             | identity only          |
// | you blocked them             | identity (+ unblock) | the same               |
// | they blocked you             | 404                  | 404                    |

const JWT_SECRET = "test-secret";
const VIEWER_ID = new Types.ObjectId();
const HOST_ID = new Types.ObjectId();

const IDENTITY_KEYS = ["avatarUrl", "displayName", "id", "username"];
const PROFILE_KEYS = [...IDENTITY_KEYS, "bio", "socials"].sort();
const VIEW_KEYS = ["connectionId", "mutualFriends", "profile", "relationship"];

const HOST_IDENTITY = {
  id: HOST_ID.toString(),
  username: "sarah",
  displayName: "Sarah Kim",
  avatarUrl: "https://example.com/sarah.png",
};
const HOST_DETAILS = {
  bio: "climbing, coffee, late trains",
  socials: { instagram: "sarah.kim", telegram: "sarahkim" },
};
const HIDDEN_DETAILS = { bio: null, socials: { instagram: null, telegram: null } };
const NO_MUTUAL_FRIENDS = { count: 0, preview: [] };

let mongoServer: MongoMemoryReplSet;
let app: Express;

const users = () => mongoose.connection.db!.collection("users");

const tokenFor = (userId: Types.ObjectId) =>
  jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: "5m" });

const getProfile = (username: string, viewer = VIEWER_ID) =>
  request(app)
    .get(`/api/v1/users/by-username/${username}`)
    .set("Authorization", `Bearer ${tokenFor(viewer)}`);

const getMutualFriends = (username: string, query = "", viewer = VIEWER_ID) =>
  request(app)
    .get(`/api/v1/users/by-username/${username}/mutual-friends${query}`)
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
    bio: HOST_DETAILS.bio,
    instagram: HOST_DETAILS.socials.instagram,
    telegram: HOST_DETAILS.socials.telegram,
    ...overrides,
  });

const insertViewer = () =>
  users().insertOne({
    _id: VIEWER_ID,
    username: "viewer",
    displayName: "Vera Viewer",
    email: "vera@example.com",
    profileVisibility: "public",
  });

const insertFriend = async (displayName: string, overrides: Record<string, unknown> = {}) => {
  const _id = new Types.ObjectId();
  const username = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  await users().insertOne({
    _id,
    username,
    displayName,
    email: `${username}@example.com`,
    avatarUrl: `https://example.com/${username}.png`,
    profileVisibility: "private",
    bio: `${username} bio`,
    instagram: `${username}.ig`,
    telegram: `${username}tg`,
    ...overrides,
  });
  return _id;
};

// A connection is a mirrored pair of accepted rows (#260).
const connect = (a: Types.ObjectId, b: Types.ObjectId) =>
  Connection.create([
    { requesterId: a, receiverId: b, status: "accepted", type: "shared_invitation" },
    { requesterId: b, receiverId: a, status: "accepted", type: "shared_invitation" },
  ]);

const block = (blockerId: Types.ObjectId, blockedId: Types.ObjectId) =>
  Block.create({ blockerId, blockedId });

const identityOf = (id: Types.ObjectId, displayName: string) => {
  const username = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    id: id.toString(),
    username,
    displayName,
    avatarUrl: `https://example.com/${username}.png`,
  };
};

// Two friends the viewer and the host share, so every "full" row has
// something to show and every gated row has something to hide.
const seedMutualFriends = async () => {
  const ana = await insertFriend("Ana Mutual");
  const ben = await insertFriend("Ben Mutual");
  await connect(VIEWER_ID, ana);
  await connect(HOST_ID, ana);
  await connect(VIEWER_ID, ben);
  await connect(HOST_ID, ben);
  return {
    ana,
    ben,
    expected: {
      count: 2,
      preview: [identityOf(ana, "Ana Mutual"), identityOf(ben, "Ben Mutual")],
    },
  };
};

const expectGatedShape = (data: Record<string, unknown>) => {
  expect(Object.keys(data).sort()).toEqual(VIEW_KEYS);
  expect(Object.keys(data.profile as object).sort()).toEqual(PROFILE_KEYS);
};

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

describe("GET /users/by-username/:username: the visibility table (#166)", () => {
  describe.each(["public", "private"] as const)("on a %s profile", (profileVisibility) => {
    it("self sees everything", async () => {
      await insertHost({ profileVisibility });

      const res = await getProfile("sarah", HOST_ID).expect(200);

      expect(res.body.data).toEqual({
        profile: { ...HOST_IDENTITY, ...HOST_DETAILS },
        relationship: "self",
        connectionId: null,
        // Everyone you know would be "mutual" with yourself: not shown.
        mutualFriends: NO_MUTUAL_FRIENDS,
      });
    });

    it("a connection sees identity, bio, socials and mutual friends", async () => {
      await Promise.all([insertHost({ profileVisibility }), insertViewer()]);
      await connect(VIEWER_ID, HOST_ID);
      const { expected } = await seedMutualFriends();

      const res = await getProfile("sarah").expect(200);

      expect(res.body.data).toEqual({
        profile: { ...HOST_IDENTITY, ...HOST_DETAILS },
        relationship: "connected",
        connectionId: null,
        mutualFriends: expected,
      });
    });

    it("the viewer who blocked them sees identity and nothing else, even with past mutual friends", async () => {
      await Promise.all([insertHost({ profileVisibility }), insertViewer()]);
      await seedMutualFriends();
      await block(VIEWER_ID, HOST_ID);

      const res = await getProfile("sarah").expect(200);

      expect(res.body.data).toEqual({
        profile: { ...HOST_IDENTITY, ...HIDDEN_DETAILS },
        relationship: "blocked",
        connectionId: null,
        mutualFriends: NO_MUTUAL_FRIENDS,
      });
      await getMutualFriends("sarah").expect(200, {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it("a viewer they blocked gets the same 404 as an unknown username, on the list too", async () => {
      await Promise.all([insertHost({ profileVisibility }), insertViewer()]);
      await seedMutualFriends();
      await block(HOST_ID, VIEWER_ID);
      // Even a leftover accepted pair doesn't get them through.
      await connect(VIEWER_ID, HOST_ID);

      const blocked = await getProfile("sarah").expect(404);
      const unknown = await getProfile("nobody-here").expect(404);
      expect(blocked.body).toEqual(unknown.body);
      expect(blocked.body.error.code).toBe("USER_NOT_FOUND");
      expect(JSON.stringify(blocked.body)).not.toContain("Sarah");

      const blockedList = await getMutualFriends("sarah").expect(404);
      const unknownList = await getMutualFriends("nobody-here").expect(404);
      expect(blockedList.body).toEqual(unknownList.body);
    });

    it("a block both ways reads as the viewer's own block: identity only", async () => {
      await insertHost({ profileVisibility });
      await block(HOST_ID, VIEWER_ID);
      await block(VIEWER_ID, HOST_ID);

      const res = await getProfile("sarah").expect(200);

      expect(res.body.data).toMatchObject({
        profile: { ...HOST_IDENTITY, ...HIDDEN_DETAILS },
        relationship: "blocked",
        mutualFriends: NO_MUTUAL_FRIENDS,
      });
    });
  });

  it("a signed-in stranger sees everything on a public profile, mutual friends included", async () => {
    await Promise.all([insertHost(), insertViewer()]);
    const { expected } = await seedMutualFriends();

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toEqual({
      profile: { ...HOST_IDENTITY, ...HOST_DETAILS },
      relationship: "none",
      connectionId: null,
      mutualFriends: expected,
    });
  });

  it("a signed-in stranger sees only name, @username and photo on a private profile", async () => {
    await Promise.all([insertHost({ profileVisibility: "private" }), insertViewer()]);
    await seedMutualFriends();

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toEqual({
      profile: { ...HOST_IDENTITY, ...HIDDEN_DETAILS },
      relationship: "none",
      connectionId: null,
      mutualFriends: NO_MUTUAL_FRIENDS,
    });
    const raw = JSON.stringify(res.body);
    for (const hidden of ["climbing", "sarah.kim", "sarahkim", "Ana Mutual", "Ben Mutual"]) {
      expect(raw).not.toContain(hidden);
    }
    await getMutualFriends("sarah").expect(200, {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it("does not reveal that a profile is private: it looks exactly like a public one left empty", async () => {
    // A private profile full of details and shared friends...
    await Promise.all([insertHost({ profileVisibility: "private" }), insertViewer()]);
    await seedMutualFriends();
    const privateRes = await getProfile("sarah").expect(200);
    const privateList = await getMutualFriends("sarah").expect(200);

    // ...and a public profile whose owner filled in nothing and shares no one.
    await Promise.all([users().deleteMany({}), Connection.deleteMany({})]);
    await Promise.all([
      insertHost({ profileVisibility: "public", bio: null, instagram: null, telegram: null }),
      insertViewer(),
    ]);
    const publicRes = await getProfile("sarah").expect(200);
    const publicList = await getMutualFriends("sarah").expect(200);

    expect(privateRes.body).toEqual(publicRes.body);
    expect(privateList.body).toEqual(publicList.body);
    expect(JSON.stringify(privateRes.body)).not.toContain("private");
  });

  it.each([
    ["pending_outgoing", VIEWER_ID, HOST_ID],
    ["pending_incoming", HOST_ID, VIEWER_ID],
  ] as const)(
    "a %s request is still a stranger: identity only on a private profile",
    async (relationship, requesterId, receiverId) => {
      await Promise.all([insertHost({ profileVisibility: "private" }), insertViewer()]);
      await seedMutualFriends();
      const pending = await Connection.create({
        requesterId,
        receiverId,
        status: "pending",
        type: "shared_invitation",
      });

      const res = await getProfile("sarah").expect(200);

      expect(res.body.data).toEqual({
        profile: { ...HOST_IDENTITY, ...HIDDEN_DETAILS },
        relationship,
        connectionId: pending._id.toString(),
        mutualFriends: NO_MUTUAL_FRIENDS,
      });
    }
  );

  it("a one-sided accepted row is not a connection: identity only on a private profile (#260)", async () => {
    await Promise.all([insertHost({ profileVisibility: "private" }), insertViewer()]);
    await Connection.create({
      requesterId: HOST_ID,
      receiverId: VIEWER_ID,
      status: "accepted",
      type: "shared_invitation",
    });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data).toMatchObject({
      profile: HIDDEN_DETAILS,
      relationship: "none",
      mutualFriends: NO_MUTUAL_FRIENDS,
    });
  });

  it("returns one shape for every viewer", async () => {
    await Promise.all([insertHost({ profileVisibility: "private" }), insertViewer()]);

    expectGatedShape((await getProfile("sarah", HOST_ID).expect(200)).body.data);
    expectGatedShape((await getProfile("sarah").expect(200)).body.data);
    await connect(VIEWER_ID, HOST_ID);
    expectGatedShape((await getProfile("sarah").expect(200)).body.data);
    await block(VIEWER_ID, HOST_ID);
    expectGatedShape((await getProfile("sarah").expect(200)).body.data);
  });
});

describe("mutual friends", () => {
  it("counts only people connected to both, and excludes anyone in a block with the viewer or the host", async () => {
    await Promise.all([insertHost(), insertViewer()]);
    const { ana, ben } = await seedMutualFriends();

    // Connected to both, but blocked the viewer (rows left over on purpose).
    const blockedViewer = await insertFriend("Cara BlockedViewer");
    await connect(VIEWER_ID, blockedViewer);
    await connect(HOST_ID, blockedViewer);
    await block(blockedViewer, VIEWER_ID);
    // Connected to both, but the viewer blocked them.
    const viewerBlocked = await insertFriend("Dan ViewerBlocked");
    await connect(VIEWER_ID, viewerBlocked);
    await connect(HOST_ID, viewerBlocked);
    await block(VIEWER_ID, viewerBlocked);
    // Connected to both, but in a block with the host.
    const hostBlocked = await insertFriend("Eve HostBlocked");
    await connect(VIEWER_ID, hostBlocked);
    await connect(HOST_ID, hostBlocked);
    await block(HOST_ID, hostBlocked);
    // Only the host's friend: the host's own network is never exposed.
    const hostOnly = await insertFriend("Finn HostOnly");
    await connect(HOST_ID, hostOnly);
    // Only the viewer's friend.
    const viewerOnly = await insertFriend("Gus ViewerOnly");
    await connect(VIEWER_ID, viewerOnly);
    // One-sided with the host, and pending with the viewer: neither counts.
    const halfway = await insertFriend("Hal Halfway");
    await Connection.create([
      { requesterId: HOST_ID, receiverId: halfway, status: "accepted", type: "qr" },
      { requesterId: VIEWER_ID, receiverId: halfway, status: "pending", type: "qr" },
    ]);

    const res = await getProfile("sarah").expect(200);
    const list = await getMutualFriends("sarah").expect(200);

    const expected = [identityOf(ana, "Ana Mutual"), identityOf(ben, "Ben Mutual")];
    expect(res.body.data.mutualFriends).toEqual({ count: 2, preview: expected });
    expect(list.body).toEqual({
      data: expected,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });

  it("counts the host's connection to the viewer as neither a mutual friend", async () => {
    await Promise.all([insertHost(), insertViewer()]);
    await connect(VIEWER_ID, HOST_ID);

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data.mutualFriends).toEqual(NO_MUTUAL_FRIENDS);
  });

  it("previews the first three by name, counts them all, and pages through the list", async () => {
    await Promise.all([insertHost(), insertViewer()]);
    const names = ["erin", "Dora", "carl", "Bea", "adam"];
    const ids = new Map<string, Types.ObjectId>();
    for (const name of names) {
      const id = await insertFriend(name);
      ids.set(name, id);
      await connect(VIEWER_ID, id);
      await connect(HOST_ID, id);
    }
    // Case-insensitive name order.
    const ordered = ["adam", "Bea", "carl", "Dora", "erin"].map((name) =>
      identityOf(ids.get(name)!, name)
    );

    const res = await getProfile("sarah").expect(200);
    expect(res.body.data.mutualFriends).toEqual({ count: 5, preview: ordered.slice(0, 3) });

    const page1 = await getMutualFriends("sarah", "?limit=2").expect(200);
    const page3 = await getMutualFriends("sarah", "?limit=2&page=3").expect(200);
    expect(page1.body).toEqual({
      data: ordered.slice(0, 2),
      pagination: { page: 1, limit: 2, total: 5, totalPages: 3 },
    });
    expect(page3.body).toEqual({
      data: ordered.slice(4),
      pagination: { page: 3, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it("returns identities only: never a mutual friend's bio, socials, email or visibility", async () => {
    await Promise.all([insertHost(), insertViewer()]);
    await seedMutualFriends();

    const res = await getProfile("sarah").expect(200);
    const list = await getMutualFriends("sarah").expect(200);

    for (const friend of [...res.body.data.mutualFriends.preview, ...list.body.data]) {
      expect(Object.keys(friend).sort()).toEqual(IDENTITY_KEYS);
    }
    const raw = JSON.stringify([res.body.data.mutualFriends, list.body]);
    for (const leaked of ["anamutual bio", "anamutual.ig", "@example.com", "private"]) {
      expect(raw).not.toContain(leaked);
    }
  });

  it("gives a connection the list on a private profile, and self an empty one", async () => {
    await Promise.all([insertHost({ profileVisibility: "private" }), insertViewer()]);
    await connect(VIEWER_ID, HOST_ID);
    const { expected } = await seedMutualFriends();

    const list = await getMutualFriends("sarah").expect(200);
    expect(list.body.data).toEqual(expected.preview);

    const own = await getMutualFriends("sarah", "", HOST_ID).expect(200);
    expect(own.body.data).toEqual([]);
  });

  it("validates the list query", async () => {
    await insertHost();

    await getMutualFriends("sarah", "?limit=51").expect(400);
    await getMutualFriends("sarah", "?page=0").expect(400);
    await getMutualFriends("sarah", "?everyone=1").expect(400);
    await getMutualFriends("sarah%24ne").expect(400);
  });
});

describe("profile fields", () => {
  it("reads a profile saved before #287 (no bio or handles) as empty", async () => {
    await insertHost({ bio: undefined, instagram: undefined, telegram: undefined });
    await users().updateOne({ _id: HOST_ID }, { $unset: { bio: "", instagram: "", telegram: "" } });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data.profile).toEqual({ ...HOST_IDENTITY, ...HIDDEN_DETAILS });
  });

  it("reads blank or non-text values as empty", async () => {
    await insertHost({ bio: "   ", instagram: "", telegram: 42 });

    const res = await getProfile("sarah").expect(200);

    expect(res.body.data.profile).toMatchObject(HIDDEN_DETAILS);
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
});

describe("GET /users/by-username/:username: lookup", () => {
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

  it("matches the stored username exactly", async () => {
    await insertHost();

    await getProfile("Sarah").expect(404);
    await getProfile("sar").expect(404);
    await getMutualFriends("Sarah").expect(404);
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
    await request(app).get("/api/v1/users/by-username/sarah/mutual-friends").expect(401);
  });
});
