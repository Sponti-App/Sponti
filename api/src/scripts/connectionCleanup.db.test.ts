import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Block, Connection, type ConnectionStatus } from "#models/index";
import { getRelationship } from "#services/relationshipService";
import {
  applyConnectionCleanup,
  planConnectionCleanup,
  runConnectionCleanup,
} from "./connectionCleanup.js";

// The one-off #260 cleanup, against an in-memory Mongo only. It must default
// to a dry run, report ids but never personal data, and delete exactly the
// one-sided accepted rows and the rows a block would remove today.

const DB_NAME = "sponti_connection_cleanup_test";
const API_ROOT = path.resolve(import.meta.dirname, "../..");

let mongoServer: MongoMemoryReplSet;

const id = () => new Types.ObjectId().toString();

const row = (from: string, to: string, status: ConnectionStatus) =>
  Connection.create({
    requesterId: new Types.ObjectId(from),
    receiverId: new Types.ObjectId(to),
    status,
    type: "shared_invitation",
  });

const block = (blocker: string, blocked: string) =>
  Block.create({ blockerId: new Types.ObjectId(blocker), blockedId: new Types.ObjectId(blocked) });

const ids = (docs: Array<{ _id: Types.ObjectId }>) => docs.map((doc) => doc._id.toString()).sort();

// A realistic pre-#260 database. Returns which rows must go and which stay.
const seed = async () => {
  const [me, friend, ghost, halfway, blockedMe, refuser, blockerOwn, refusedBlocker, asker] = [
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
  ];

  await mongoose.connection.db!.collection("users").insertOne({
    _id: new Types.ObjectId(me),
    username: "secret-username",
    email: "secret@example.com",
  });

  const keep = [
    // A real connection: both rows accepted.
    await row(me, friend, "accepted"),
    await row(friend, me, "accepted"),
    // A plain pending request.
    await row(asker, me, "pending"),
  ];
  const oneSided = [
    // Left behind when `me` blocked `ghost` and later unblocked them.
    await row(ghost, me, "accepted"),
  ];
  // Accepted one way, only pending the other: the accepted row goes, the
  // pending request stays so it can still be answered.
  const halfAccepted = await row(me, halfway, "accepted");
  keep.push(await row(halfway, me, "pending"));
  oneSided.push(halfAccepted);

  // Still blocked: `blockedMe` blocked `me`; my accepted row to them survived.
  await block(blockedMe, me);
  const blockedPair = [await row(me, blockedMe, "accepted")];
  // `refuser` turned down my request, then blocked me: their refusal stays.
  await block(refuser, me);
  keep.push(await row(me, refuser, "rejected"));
  // The blocker's own pending request goes.
  await block(blockerOwn, me);
  blockedPair.push(await row(blockerOwn, me, "pending"));
  // I turned down `refusedBlocker`, who then blocked me: my refusal stays too.
  await block(refusedBlocker, me);
  keep.push(await row(refusedBlocker, me, "rejected"));

  return { me, ghost, keep, oneSided, blockedPair };
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: DB_NAME });
  await Promise.all([Block.syncIndexes(), Connection.syncIndexes()]);
}, 120_000);

afterEach(async () => {
  await Promise.all([
    Block.deleteMany({}),
    Connection.deleteMany({}),
    mongoose.connection.db!.collection("users").deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

describe("planConnectionCleanup", () => {
  it("finds one-sided accepted rows and rows a block would remove, nothing else", async () => {
    const { keep, oneSided, blockedPair } = await seed();

    const plan = await planConnectionCleanup();

    expect(plan.counts).toEqual({ blocked_pair: 2, one_sided_accepted: 2 });
    expect(
      plan.rows
        .filter((r) => r.reason === "one_sided_accepted")
        .map((r) => r.connectionId)
        .sort()
    ).toEqual(ids(oneSided));
    expect(
      plan.rows
        .filter((r) => r.reason === "blocked_pair")
        .map((r) => r.connectionId)
        .sort()
    ).toEqual(ids(blockedPair));
    const planned = new Set(plan.rows.map((r) => r.connectionId));
    expect(ids(keep).filter((keptId) => planned.has(keptId))).toEqual([]);
    expect(plan.scannedConnections).toBe(keep.length + oneSided.length + blockedPair.length);
    expect(plan.rows.filter((r) => r.status === "rejected")).toEqual([]);
    expect(plan.scannedBlocks).toBe(4);
  });

  it("finds nothing in clean data", async () => {
    const [a, b] = [id(), id()];
    await row(a, b, "accepted");
    await row(b, a, "accepted");

    expect((await planConnectionCleanup()).rows).toEqual([]);
  });
});

describe("runConnectionCleanup", () => {
  it("dry run (the default) reports ids and counts, deletes nothing, and prints no personal data", async () => {
    const { oneSided, blockedPair } = await seed();
    const before = await Connection.countDocuments({});
    const lines: string[] = [];

    const result = await runConnectionCleanup({ apply: false, log: (line) => lines.push(line) });
    const output = lines.join("\n");

    expect(result.deleted).toBe(0);
    expect(await Connection.countDocuments({})).toBe(before);
    expect(output).toContain("mode: dry-run");
    expect(output).toContain("to delete: 4 (blocked_pair: 2, one_sided_accepted: 2)");
    for (const doc of [...oneSided, ...blockedPair]) {
      expect(output).toContain(`connection=${doc._id.toString()}`);
    }
    expect(output).not.toContain("secret");
  });

  it("apply deletes exactly the planned rows and is idempotent", async () => {
    const { me, ghost, keep } = await seed();

    const result = await runConnectionCleanup({ apply: true, log: () => {} });

    expect(result.deleted).toBe(4);
    expect(ids(await Connection.find({}).lean())).toEqual(ids(keep));
    expect((await getRelationship(me, ghost)).relationship).toBe("none");
    expect((await planConnectionCleanup()).rows).toEqual([]);
  });

  it("leaves a row alone if it changed between planning and applying", async () => {
    const [a, b] = [id(), id()];
    const orphan = await row(a, b, "pending");
    await Connection.updateOne({ _id: orphan._id }, { $set: { status: "accepted" } });
    const plan = await planConnectionCleanup();
    await Connection.updateOne({ _id: orphan._id }, { $set: { status: "pending" } });

    expect(await applyConnectionCleanup(plan)).toBe(0);
    expect(await Connection.countDocuments({})).toBe(1);
  });
});

describe("cleanupConnections CLI", () => {
  // Minimal env on purpose: only the in-memory server, never api/.env.
  const runCli = (args: string[]) =>
    promisify(execFile)(
      path.join(API_ROOT, "node_modules/.bin/tsx"),
      ["--conditions=development", "src/scripts/cleanupConnections.ts", ...args],
      {
        cwd: API_ROOT,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          MONGO_URI: mongoServer.getUri(),
          DB_NAME,
        },
      }
    );

  it("is a dry run unless --apply is passed", async () => {
    const { keep } = await seed();
    const before = await Connection.countDocuments({});

    const dry = await runCli([]);
    expect(dry.stdout).toContain(`database: ${DB_NAME}`);
    expect(dry.stdout).toContain("mode: dry-run");
    expect(dry.stdout).toContain("dry run: nothing deleted");
    expect(dry.stdout).not.toContain("secret");
    expect(await Connection.countDocuments({})).toBe(before);

    const applied = await runCli(["--apply"]);
    expect(applied.stdout).toContain("mode: apply");
    expect(applied.stdout).toContain("deleted: 4");
    expect(ids(await Connection.find({}).lean())).toEqual(ids(keep));
  }, 60_000);

  it("refuses unknown arguments without touching the database", async () => {
    await seed();
    const before = await Connection.countDocuments({});

    await expect(runCli(["--aply"])).rejects.toMatchObject({ code: 2 });
    expect(await Connection.countDocuments({})).toBe(before);
  }, 60_000);
});
