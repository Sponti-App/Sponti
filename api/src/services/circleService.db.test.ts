import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Circle, CircleMember } from "#models/index";
import type { UpdateCircleBody } from "#schemas/circleSchemas";
import {
  createCircle,
  deleteCircle,
  ensureDefaultCircles,
  getMyCircles,
  updateCircle,
} from "#services/circleService";

const OWNER_ID = new Types.ObjectId().toString();
const OTHER_OWNER_ID = new Types.ObjectId().toString();
const MEMBER_ID = new Types.ObjectId().toString();

let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "sponti_circle_service_test",
  });
  await Promise.all([Circle.syncIndexes(), CircleMember.syncIndexes()]);
}, 120_000);

afterEach(async () => {
  await Promise.all([Circle.deleteMany({}), CircleMember.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 120_000);

const circlesByType = (circles: Awaited<ReturnType<typeof getMyCircles>>) =>
  new Map(circles.map((circle) => [circle.type, circle]));

describe("circleService database behavior", () => {
  it("creates and returns exactly the three protected defaults for an authenticated owner", async () => {
    const circles = await getMyCircles(OWNER_ID);
    const byType = circlesByType(circles);

    expect(circles).toHaveLength(3);
    expect([...byType.keys()].sort()).toEqual(["all", "close", "inner"]);
    expect(byType.get("close")).toMatchObject({
      name: "close friends",
      color: "#00FF00",
      type: "close",
      members: [],
    });
    expect(byType.get("inner")).toMatchObject({
      name: "inner circle",
      color: "#FF0000",
      type: "inner",
      members: [],
    });
    expect(byType.get("all")).toMatchObject({
      name: "all friends",
      color: "#FF0000",
      type: "all",
      members: [],
    });
    expect(circles.every((circle) => circle.ownerId.toString() === OWNER_ID)).toBe(true);
  });

  it("keeps the same protected records and timestamps across sequential initialization", async () => {
    const first = await getMyCircles(OWNER_ID);
    const second = await getMyCircles(OWNER_ID);

    const stableFields = (circles: typeof first) =>
      circles
        .map((circle) => ({
          id: circle._id.toString(),
          type: circle.type,
          name: circle.name,
          color: circle.color,
          createdAt: circle.createdAt.toISOString(),
          updatedAt: circle.updatedAt.toISOString(),
        }))
        .sort((left, right) => left.type.localeCompare(right.type));

    expect(second).toHaveLength(3);
    expect(stableFields(second)).toEqual(stableFields(first));
  });

  it("uses the real partial unique index to make concurrent first initialization duplicate-safe", async () => {
    await Promise.all(Array.from({ length: 20 }, () => ensureDefaultCircles(OWNER_ID)));

    const circles = await Circle.find({ ownerId: new Types.ObjectId(OWNER_ID) }).lean();
    const countByType = new Map<string, number>();

    for (const circle of circles) {
      countByType.set(circle.type, (countByType.get(circle.type) ?? 0) + 1);
    }

    expect(circles).toHaveLength(3);
    expect(Object.fromEntries(countByType)).toEqual({
      close: 1,
      inner: 1,
      all: 1,
    });

    await expect(
      Circle.create({
        ownerId: new Types.ObjectId(OWNER_ID),
        name: "another close circle",
        color: "#123456",
        type: "close",
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("preserves edits, identity, type, members, and timestamps during later initialization", async () => {
    await ensureDefaultCircles(OWNER_ID);
    const original = await Circle.findOne({
      ownerId: new Types.ObjectId(OWNER_ID),
      type: "close",
    }).orFail();
    await CircleMember.create({
      circleId: original._id,
      ownerId: new Types.ObjectId(OWNER_ID),
      userId: new Types.ObjectId(MEMBER_ID),
    });

    const edited = await updateCircle(OWNER_ID, original._id.toString(), {
      name: "the day ones",
      color: "#123456",
    });
    await ensureDefaultCircles(OWNER_ID);
    const after = circlesByType(await getMyCircles(OWNER_ID)).get("close");

    expect(after).toBeDefined();
    expect(after?._id.toString()).toBe(original._id.toString());
    expect(after).toMatchObject({
      name: "the day ones",
      color: "#123456",
      type: "close",
    });
    expect(after?.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    expect(after?.updatedAt.toISOString()).toBe(edited?.updatedAt.toISOString());
    expect(after?.members.map((member) => member.userId.toString())).toEqual([MEMBER_ID]);
  });

  it("allows multiple custom circles while ordinary creation rejects protected types", async () => {
    const first = await createCircle(OWNER_ID, {
      name: "climbers",
      type: "custom",
      memberIds: [],
    });
    const second = await createCircle(OWNER_ID, {
      name: "neighbors",
      type: "custom",
      memberIds: [],
    });

    expect(first.type).toBe("custom");
    expect(second.type).toBe("custom");
    expect(
      await Circle.countDocuments({ ownerId: new Types.ObjectId(OWNER_ID), type: "custom" })
    ).toBe(2);

    await expect(
      createCircle(OWNER_ID, {
        name: "forged inner circle",
        type: "inner",
        memberIds: [],
      } as never)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "PROTECTED_CIRCLE_TYPE_FORBIDDEN",
    });
  });

  it("does not allow a circle type to change", async () => {
    await ensureDefaultCircles(OWNER_ID);
    const circle = await Circle.findOne({
      ownerId: new Types.ObjectId(OWNER_ID),
      type: "inner",
    }).orFail();

    await expect(
      updateCircle(OWNER_ID, circle._id.toString(), {
        type: "custom",
      } as unknown as UpdateCircleBody)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "CIRCLE_TYPE_IMMUTABLE",
    });

    expect((await Circle.findById(circle._id).orFail()).type).toBe("inner");
  });

  it("rejects protected deletion and deletes an owner-authorized custom circle with its members", async () => {
    await ensureDefaultCircles(OWNER_ID);
    const protectedCircle = await Circle.findOne({
      ownerId: new Types.ObjectId(OWNER_ID),
      type: "all",
    }).orFail();
    const customCircle = await createCircle(OWNER_ID, {
      name: "running club",
      type: "custom",
      memberIds: [],
    });
    await CircleMember.create({
      circleId: customCircle._id,
      ownerId: new Types.ObjectId(OWNER_ID),
      userId: new Types.ObjectId(MEMBER_ID),
    });

    await expect(deleteCircle(OWNER_ID, protectedCircle._id.toString())).rejects.toMatchObject({
      statusCode: 409,
      code: "PROTECTED_CIRCLE_DELETE_FORBIDDEN",
    });
    await deleteCircle(OWNER_ID, customCircle._id.toString());

    expect(await Circle.exists({ _id: customCircle._id })).toBeNull();
    expect(await CircleMember.countDocuments({ circleId: customCircle._id })).toBe(0);
    expect(await Circle.exists({ _id: protectedCircle._id })).not.toBeNull();
  });

  it("retains authenticated-owner boundaries for initialization and mutations", async () => {
    await Promise.all([ensureDefaultCircles(OWNER_ID), ensureDefaultCircles(OTHER_OWNER_ID)]);
    const customCircle = await createCircle(OWNER_ID, {
      name: "book club",
      type: "custom",
      memberIds: [],
    });

    await expect(
      updateCircle(OTHER_OWNER_ID, customCircle._id.toString(), { color: "#ABCDEF" })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "CIRCLE_NOT_FOUND",
    });
    await expect(deleteCircle(OTHER_OWNER_ID, customCircle._id.toString())).rejects.toMatchObject({
      statusCode: 404,
      code: "CIRCLE_NOT_FOUND",
    });

    expect(await Circle.countDocuments({ ownerId: new Types.ObjectId(OWNER_ID) })).toBe(4);
    expect(await Circle.countDocuments({ ownerId: new Types.ObjectId(OTHER_OWNER_ID) })).toBe(3);
    expect((await Circle.findById(customCircle._id).orFail()).color).toBeNull();
  });
});
