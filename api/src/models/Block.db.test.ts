import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Block } from "#models/Block";

// The indexes the blocks collection needs (#298), against an in-memory Mongo.
// Production runs with autoIndex off, so connectDB calls Block.createIndexes();
// this test runs that same call on a fresh database.

let mongoServer: MongoMemoryReplSet;

// "blockerId_1_blockedId_1" style names: unlike comparing the key objects, they
// keep the field order, which is what makes { blockedId, blockerId } a
// different index from the unique { blockerId, blockedId }.
const indexNames = async () => (await Block.collection.indexes()).map((index) => index.name);

// Every stage name in a winning plan, for example ["FETCH", "IXSCAN"].
const stages = (plan: {
  stage?: string;
  inputStage?: unknown;
  inputStages?: unknown[];
}): string[] => [
  ...(plan.stage ? [plan.stage] : []),
  ...(plan.inputStage ? stages(plan.inputStage as typeof plan) : []),
  ...(plan.inputStages ?? []).flatMap((stage) => stages(stage as typeof plan)),
];

const winningStages = async (filter: Record<string, unknown>) => {
  const explained = await Block.collection.find(filter).explain("queryPlanner");
  return stages(explained.queryPlanner.winningPlan);
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "sponti_block_index_test",
    autoIndex: false,
  });
  await Block.createIndexes();
  await Block.insertMany(
    Array.from({ length: 50 }, () => ({
      blockerId: new Types.ObjectId(),
      blockedId: new Types.ObjectId(),
    }))
  );
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

describe("Block indexes", () => {
  it("has the unique pair and the blockedId index, and no blockerId-only index", async () => {
    const names = await indexNames();

    expect(names).toContain("blockerId_1_blockedId_1");
    expect(names).toContain("blockedId_1_blockerId_1");
    expect(names).not.toContain("blockerId_1");
  });

  it("keeps the pair unique", async () => {
    const pair = { blockerId: new Types.ObjectId(), blockedId: new Types.ObjectId() };
    await Block.create(pair);

    await expect(Block.create(pair)).rejects.toMatchObject({ code: 11000 });
  });

  it("serves a lookup by blockedId from an index", async () => {
    const plan = await winningStages({ blockedId: new Types.ObjectId() });

    expect(plan).toContain("IXSCAN");
    expect(plan).not.toContain("COLLSCAN");
  });

  it("serves a lookup by blockerId from an index", async () => {
    const plan = await winningStages({ blockerId: new Types.ObjectId() });

    expect(plan).toContain("IXSCAN");
    expect(plan).not.toContain("COLLSCAN");
  });

  it("serves the either-side $or of the block checks without a collection scan", async () => {
    const user = new Types.ObjectId();
    const plan = await winningStages({ $or: [{ blockerId: user }, { blockedId: user }] });

    expect(plan).toContain("IXSCAN");
    expect(plan).not.toContain("COLLSCAN");
  });
});
