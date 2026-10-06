import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Block, Connection, Notification, type ConnectionStatus } from "#models/index";
import { blockUser, unblockUser } from "#services/blockService";
import {
  deleteConnection,
  respondToConnectionRequest,
  sendConnectionRequest,
} from "#services/connectionService";
import { getConnectedUserIds, getRelationship } from "#services/relationshipService";
import { searchUsers } from "#services/userDirectoryService";

// The one "how are these two related" definition (#267) and what blocking
// does to it (#260), against an in-memory Mongo. Connected = an accepted row
// each way and no block either way.

const A = new Types.ObjectId().toString();
const B = new Types.ObjectId().toString();
const C = new Types.ObjectId().toString();

let mongoServer: MongoMemoryReplSet;

const users = () => mongoose.connection.db!.collection("users");

const row = (from: string, to: string, status: ConnectionStatus) =>
  Connection.create({
    requesterId: new Types.ObjectId(from),
    receiverId: new Types.ObjectId(to),
    status,
    type: "shared_invitation",
  });

// How respondToConnectionRequest and connectInPerson store a connection.
const connect = async (x: string, y: string) => {
  await row(x, y, "accepted");
  await row(y, x, "accepted");
};

const block = (blocker: string, blocked: string) =>
  Block.create({ blockerId: new Types.ObjectId(blocker), blockedId: new Types.ObjectId(blocked) });

const relationshipOf = async (viewer: string, other: string) =>
  (await getRelationship(viewer, other)).relationship;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: "sponti_relationship_test" });
  await Promise.all([Block.syncIndexes(), Connection.syncIndexes(), Notification.syncIndexes()]);
}, 120_000);

afterEach(async () => {
  await Promise.all([
    Block.deleteMany({}),
    Connection.deleteMany({}),
    Notification.deleteMany({}),
    users().deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

describe("getRelationship", () => {
  it("is self for the same user", async () => {
    expect(await getRelationship(A, A)).toEqual({
      relationship: "self",
      blockedBy: null,
      connectionId: null,
    });
  });

  it("is none with no rows at all", async () => {
    expect(await getRelationship(A, B)).toEqual({
      relationship: "none",
      blockedBy: null,
      connectionId: null,
    });
  });

  it("is connected, from both sides, with an accepted row each way", async () => {
    await connect(A, B);

    expect(await relationshipOf(A, B)).toBe("connected");
    expect(await relationshipOf(B, A)).toBe("connected");
  });

  it("does not count a one-sided accepted row as connected, from either side", async () => {
    await row(B, A, "accepted");

    expect(await relationshipOf(A, B)).toBe("none");
    expect(await relationshipOf(B, A)).toBe("none");
  });

  it("returns the pending request to the sender (outgoing) and receiver (incoming)", async () => {
    const pending = await row(A, B, "pending");

    expect(await getRelationship(A, B)).toEqual({
      relationship: "pending_outgoing",
      blockedBy: null,
      connectionId: pending._id.toString(),
    });
    expect(await getRelationship(B, A)).toEqual({
      relationship: "pending_incoming",
      blockedBy: null,
      connectionId: pending._id.toString(),
    });
  });

  it("reads a rejected request as none, for the requester and for whoever rejected it", async () => {
    await row(A, B, "rejected");

    expect(await relationshipOf(A, B)).toBe("none");
    expect(await relationshipOf(B, A)).toBe("none");
  });

  it("shows a new request over a leftover one-sided accepted row", async () => {
    await row(B, A, "accepted");
    const pending = await row(A, B, "pending");

    expect(await getRelationship(A, B)).toMatchObject({
      relationship: "pending_outgoing",
      connectionId: pending._id.toString(),
    });
    expect(await relationshipOf(B, A)).toBe("pending_incoming");
  });

  it("is blocked either way, and says who placed the block", async () => {
    await connect(A, B);
    await block(A, B);

    expect(await getRelationship(A, B)).toEqual({
      relationship: "blocked",
      blockedBy: "viewer",
      connectionId: null,
    });
    expect(await getRelationship(B, A)).toEqual({
      relationship: "blocked",
      blockedBy: "other",
      connectionId: null,
    });
  });

  it("reports the viewer's own block when both blocked each other", async () => {
    await block(A, B);
    await block(B, A);

    expect((await getRelationship(A, B)).blockedBy).toBe("viewer");
    expect((await getRelationship(B, A)).blockedBy).toBe("viewer");
  });
});

describe("getConnectedUserIds", () => {
  it("returns only mutual, unblocked connections", async () => {
    const D = new Types.ObjectId().toString();
    const E = new Types.ObjectId().toString();
    const F = new Types.ObjectId().toString();
    const G = new Types.ObjectId().toString();
    await connect(A, B); // connected
    await row(C, A, "accepted"); // one-sided
    await row(A, D, "pending");
    await row(E, A, "rejected");
    await connect(A, F);
    await block(F, A); // blocked the other way
    await connect(A, G);
    await block(A, G);

    expect(await getConnectedUserIds(A)).toEqual(new Set([B]));
    expect(await getConnectedUserIds(C)).toEqual(new Set());
  });

  it("only checks the given candidates when asked to", async () => {
    await connect(A, B);
    await connect(A, C);

    expect(await getConnectedUserIds(A, [C, C])).toEqual(new Set([C]));
    expect(await getConnectedUserIds(A, [])).toEqual(new Set());
  });
});

describe("blocking deletes both connection rows (#260)", () => {
  for (const [blocker, blocked, label] of [
    [A, B, "the original requester blocks"],
    [B, A, "the other side blocks"],
  ] as const) {
    it(`leaves neither side connected after block and unblock (${label})`, async () => {
      await connect(A, B);

      await blockUser(blocker, blocked);

      expect(await Connection.countDocuments({})).toBe(0);
      expect(await relationshipOf(A, B)).toBe("blocked");

      await unblockUser(blocker, blocked);

      expect(await relationshipOf(A, B)).toBe("none");
      expect(await relationshipOf(B, A)).toBe("none");
      expect(await getConnectedUserIds(A)).toEqual(new Set());
      expect(await getConnectedUserIds(B)).toEqual(new Set());
    });
  }

  it("removes pending requests both ways", async () => {
    await row(A, B, "pending");
    await row(B, A, "pending");

    await blockUser(A, B);

    expect(await Connection.countDocuments({})).toBe(0);
  });

  it("keeps the blocked person's earlier refusal of the blocker, and retrying still fails", async () => {
    // B rejected A, then A blocks B and unblocks: B's "no" survives.
    const refusal = await row(A, B, "rejected");

    await blockUser(A, B);
    await unblockUser(A, B);

    const remaining = await Connection.find({}).lean();
    expect(remaining.map((r) => r._id.toString())).toEqual([refusal._id.toString()]);
    expect(await relationshipOf(A, B)).toBe("none");
    // Current retry-after-rejection rule still applies to A.
    await expect(
      sendConnectionRequest(A, { receiverId: B, type: "shared_invitation" })
    ).rejects.toMatchObject({ statusCode: 409, code: "CONNECTION_REJECTED" });
  });

  it("keeps the blocker's own refusal of the blocked person", async () => {
    // B asked, A said no, then A blocks B: B still can't just re-request.
    const refusal = await row(B, A, "rejected");

    await blockUser(A, B);
    await unblockUser(A, B);

    const remaining = await Connection.find({}).lean();
    expect(remaining.map((r) => r._id.toString())).toEqual([refusal._id.toString()]);
    expect(await relationshipOf(B, A)).toBe("none");
  });

  it("does not touch the blocker's other connections", async () => {
    await connect(A, B);
    await connect(A, C);

    await blockUser(A, B);

    expect(await getConnectedUserIds(A)).toEqual(new Set([C]));
    expect(await Connection.countDocuments({})).toBe(2);
  });
});

describe("accepting a request between a blocked pair (#444)", () => {
  // A asked B. The block is placed without going through blockUser, so the
  // pending row survives, like a request that raced the block or old data.
  for (const [blocker, blocked, label] of [
    [A, B, "the requester blocked the receiver"],
    [B, A, "the receiver blocked the requester"],
  ] as const) {
    it(`fails like a missing request and connects nobody (${label})`, async () => {
      const pending = await row(A, B, "pending");
      await block(blocker, blocked);

      await expect(
        respondToConnectionRequest(B, String(pending._id), { status: "accepted" })
      ).rejects.toMatchObject({ statusCode: 404, code: "CONNECTION_REQUEST_NOT_FOUND" });

      const rows = await Connection.find({}).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "pending" });
      expect(await relationshipOf(A, B)).toBe("blocked");
      expect(await getConnectedUserIds(A)).toEqual(new Set());
      expect(await getConnectedUserIds(B)).toEqual(new Set());
      expect(await Notification.countDocuments({})).toBe(0);
    });
  }

  it("still lets the receiver decline it", async () => {
    const pending = await row(A, B, "pending");
    await block(A, B);

    await respondToConnectionRequest(B, String(pending._id), { status: "rejected" });

    expect(await Connection.findById(pending._id).lean()).toMatchObject({ status: "rejected" });
  });

  it("still accepts a request between an unblocked pair", async () => {
    const pending = await row(A, B, "pending");

    await respondToConnectionRequest(B, String(pending._id), { status: "accepted" });

    expect(await relationshipOf(A, B)).toBe("connected");
  });

  it("can't be accepted after a real block either, since blocking removes the request", async () => {
    const pending = await row(A, B, "pending");

    await blockUser(B, A);

    await expect(
      respondToConnectionRequest(B, String(pending._id), { status: "accepted" })
    ).rejects.toMatchObject({ statusCode: 404, code: "CONNECTION_REQUEST_NOT_FOUND" });
  });
});

describe("deleteConnection", () => {
  it("removes the mirrored row with an accepted one, so neither side is left connected", async () => {
    await connect(A, B);
    const own = await Connection.findOne({ requesterId: new Types.ObjectId(A) }).lean();

    await deleteConnection(A, own!._id.toString());

    expect(await Connection.countDocuments({})).toBe(0);
    expect(await relationshipOf(B, A)).toBe("none");
  });

  it("cancels only the caller's pending request", async () => {
    const pending = await row(A, B, "pending");
    const other = await row(C, B, "pending");

    await deleteConnection(A, pending._id.toString());

    const remaining = await Connection.find({}).lean();
    expect(remaining.map((r) => r._id.toString())).toEqual([other._id.toString()]);
  });

  it("can't delete someone else's row", async () => {
    const theirs = await row(B, A, "accepted");

    await expect(deleteConnection(A, theirs._id.toString())).rejects.toMatchObject({
      statusCode: 404,
      code: "CONNECTION_NOT_FOUND",
    });
    expect(await Connection.countDocuments({})).toBe(1);
  });
});

describe("search uses the same definition", () => {
  it("only surfaces a private user by partial name to a real connection", async () => {
    await users().insertOne({
      _id: new Types.ObjectId(B),
      username: "zoe.private",
      displayName: "Zoe",
      profileVisibility: "private",
    });

    await row(B, A, "accepted"); // one-sided: not a connection
    expect(await searchUsers(A, { q: "zoe", limit: 20 })).toEqual([]);

    await row(A, B, "accepted");
    const found = await searchUsers(A, { q: "zoe", limit: 20 });
    expect(found.map((user) => user._id)).toEqual([B]);
  });
});
