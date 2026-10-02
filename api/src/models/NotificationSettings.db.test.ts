import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotificationSettings } from "#models/NotificationSettings";

// Production runs with autoIndex off, so connectDB calls createIndexes(). The
// userId index must stay exactly one unique "userId_1" (#329).

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "sponti_notification_settings_index_test",
    autoIndex: false,
  });
  await NotificationSettings.createIndexes();
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

describe("NotificationSettings indexes", () => {
  it("has exactly one userId index, named userId_1 and unique", async () => {
    const userIdIndexes = (await NotificationSettings.collection.indexes()).filter(
      (index) => "userId" in index.key
    );

    expect(userIdIndexes).toHaveLength(1);
    expect(userIdIndexes[0]).toMatchObject({ name: "userId_1", key: { userId: 1 }, unique: true });
  });

  it("declares the userId index once on the schema", () => {
    const declared = NotificationSettings.schema
      .indexes()
      .filter(([fields]: [Record<string, unknown>, unknown]) => "userId" in fields);

    expect(declared).toHaveLength(1);
    expect(declared[0][1]).toMatchObject({ unique: true });
  });
});
