import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateCircleBody } from "#schemas/circleSchemas";

const circleCreateMock = vi.hoisted(() => vi.fn());
const circleDeleteOneMock = vi.hoisted(() => vi.fn());
const circleExistsMock = vi.hoisted(() => vi.fn());
const circleFindMock = vi.hoisted(() => vi.fn());
const circleFindOneMock = vi.hoisted(() => vi.fn());
const circleFindOneAndUpdateMock = vi.hoisted(() => vi.fn());
const circleUpdateOneMock = vi.hoisted(() => vi.fn());
const circleMemberCreateMock = vi.hoisted(() => vi.fn());
const circleMemberDeleteManyMock = vi.hoisted(() => vi.fn());
const connectionFindMock = vi.hoisted(() => vi.fn());
const getUsersByIdsMock = vi.hoisted(() => vi.fn());
const transactionSessionMock = vi.hoisted(() => ({ id: "transaction-session" }));

vi.mock("#models/index", () => ({
  Circle: {
    create: circleCreateMock,
    deleteOne: circleDeleteOneMock,
    exists: circleExistsMock,
    find: circleFindMock,
    findOne: circleFindOneMock,
    findOneAndUpdate: circleFindOneAndUpdateMock,
    updateOne: circleUpdateOneMock,
  },
  CircleMember: {
    create: circleMemberCreateMock,
    deleteMany: circleMemberDeleteManyMock,
    deleteOne: vi.fn(),
    find: vi.fn(),
  },
  Connection: { find: connectionFindMock },
}));

vi.mock("#services/userDirectoryService", () => ({
  getUsersByIds: getUsersByIdsMock,
}));

vi.mock("#utils/transactions", () => ({
  withTransactionFallback: vi.fn((callback: (session?: unknown) => unknown) =>
    callback(transactionSessionMock)
  ),
}));

const { createCircle, deleteCircle, ensureDefaultCircles, getMyCircles, updateCircle } =
  await import("#services/circleService");
const { createCircleBodySchema, updateCircleBodySchema } = await import("#schemas/circleSchemas");

const OWNER_ID = "507f1f77bcf86cd799439011";
const OTHER_OWNER_ID = "507f1f77bcf86cd799439015";
const MEMBER_ONE_ID = "507f1f77bcf86cd799439012";
const MEMBER_TWO_ID = "507f1f77bcf86cd799439013";
const CIRCLE_ID = "507f1f77bcf86cd799439014";

afterEach(() => {
  vi.clearAllMocks();
});

const mockUniqueCircleName = (circle: unknown = null) => {
  const leanMock = vi.fn().mockResolvedValue(circle);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  const collationMock = vi.fn().mockReturnValue({ select: selectMock });
  circleFindOneMock.mockReturnValue({ collation: collationMock });
  return { collationMock, leanMock, selectMock };
};

const mockAcceptedConnections = (connections: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(connections);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  connectionFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
};

const mockCircleTypeLookup = (type: "close" | "inner" | "all" | "custom" | null) => {
  const leanMock = vi.fn().mockResolvedValue(type ? { _id: CIRCLE_ID, type } : null);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  circleFindOneMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
};

const memberDocument = (userId: string) => ({
  circleId: CIRCLE_ID,
  ownerId: OWNER_ID,
  userId,
  toObject: () => ({
    circleId: CIRCLE_ID,
    ownerId: OWNER_ID,
    userId,
  }),
});

describe("circleService.createCircle", () => {
  it("uses ordered batch create when adding initial members in a transaction", async () => {
    mockUniqueCircleName();
    mockAcceptedConnections([
      { requesterId: OWNER_ID, receiverId: MEMBER_ONE_ID },
      { requesterId: OWNER_ID, receiverId: MEMBER_TWO_ID },
    ]);
    circleCreateMock.mockResolvedValue([
      {
        _id: CIRCLE_ID,
        toObject: () => ({
          _id: CIRCLE_ID,
          ownerId: OWNER_ID,
          name: "close friends",
          color: null,
          type: "custom",
          icon: null,
        }),
      },
    ]);
    circleMemberCreateMock.mockResolvedValue([
      memberDocument(MEMBER_ONE_ID),
      memberDocument(MEMBER_TWO_ID),
    ]);
    getUsersByIdsMock.mockResolvedValue(new Map());

    await createCircle(OWNER_ID, {
      name: "close friends",
      type: "custom",
      memberIds: [MEMBER_ONE_ID, MEMBER_TWO_ID],
    });

    expect(circleMemberCreateMock).toHaveBeenCalledOnce();
    expect(circleMemberCreateMock).toHaveBeenCalledWith(expect.any(Array), {
      session: transactionSessionMock,
      ordered: true,
    });
    const docs = circleMemberCreateMock.mock.calls[0]?.[0] as Array<{ userId: unknown }>;
    expect(docs.map((doc) => String(doc.userId))).toEqual([MEMBER_ONE_ID, MEMBER_TWO_ID]);
  });
});

describe("circle request schemas", () => {
  it("allows only custom types during ordinary creation", () => {
    expect(
      createCircleBodySchema.safeParse({
        name: "weekend crew",
        type: "custom",
      }).success
    ).toBe(true);
    expect(
      createCircleBodySchema.safeParse({
        name: "forged default",
        type: "close",
      }).success
    ).toBe(false);
  });

  it("does not accept type changes during updates", () => {
    expect(updateCircleBodySchema.safeParse({ name: "renamed" }).success).toBe(true);
    expect(updateCircleBodySchema.safeParse({ type: "custom" }).success).toBe(false);
  });
});

describe("circleService.ensureDefaultCircles", () => {
  it("upserts all protected defaults using insert-only values and stable timestamps", async () => {
    circleUpdateOneMock.mockResolvedValue({ acknowledged: true });

    await ensureDefaultCircles(OWNER_ID);

    expect(circleUpdateOneMock).toHaveBeenCalledTimes(3);
    expect(circleUpdateOneMock).toHaveBeenCalledWith(
      {
        ownerId: expect.objectContaining({ _bsontype: "ObjectId" }),
        type: "close",
      },
      {
        $setOnInsert: expect.objectContaining({
          ownerId: expect.objectContaining({ _bsontype: "ObjectId" }),
          type: "close",
          name: "close friends",
          color: "#00FF00",
          icon: null,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      },
      {
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        timestamps: false,
      }
    );
    const insertedValues = circleUpdateOneMock.mock.calls.map(
      (call) => call[1].$setOnInsert as { createdAt: Date; updatedAt: Date }
    );
    expect(new Set(insertedValues.map((value) => value.createdAt.getTime())).size).toBe(1);
    expect(insertedValues.every((value) => value.createdAt === value.updatedAt)).toBe(true);
  });

  it("treats a duplicate-key race as success only when the protected type now exists", async () => {
    const duplicateKeyError = { code: 11000, keyValue: { name: "close friends" } };
    circleUpdateOneMock
      .mockRejectedValueOnce(duplicateKeyError)
      .mockResolvedValue({ acknowledged: true });
    circleExistsMock.mockResolvedValue({ _id: CIRCLE_ID });

    await expect(ensureDefaultCircles(OWNER_ID)).resolves.toBeUndefined();

    expect(circleExistsMock).toHaveBeenCalledWith({
      ownerId: expect.objectContaining({ _bsontype: "ObjectId" }),
      type: "close",
    });
  });

  it("propagates duplicate-key conflicts when no protected circle won the race", async () => {
    const duplicateKeyError = { code: 11000, keyValue: { name: "close friends" } };
    circleUpdateOneMock
      .mockRejectedValueOnce(duplicateKeyError)
      .mockResolvedValue({ acknowledged: true });
    circleExistsMock.mockResolvedValue(null);

    await expect(ensureDefaultCircles(OWNER_ID)).rejects.toBe(duplicateKeyError);
  });

  it("does not return an incomplete list after an unexpected database failure", async () => {
    const databaseError = new Error("database unavailable");
    circleUpdateOneMock.mockRejectedValue(databaseError);

    await expect(getMyCircles(OWNER_ID)).rejects.toBe(databaseError);

    expect(circleFindMock).not.toHaveBeenCalled();
  });
});

describe("circleService protected/custom invariants", () => {
  it("rejects protected types even when schema validation is bypassed", async () => {
    await expect(
      createCircle(OWNER_ID, {
        name: "forged default",
        type: "close",
        memberIds: [],
      } as never)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "PROTECTED_CIRCLE_TYPE_FORBIDDEN",
    });

    expect(circleCreateMock).not.toHaveBeenCalled();
  });

  it("rejects type updates even when schema validation is bypassed", async () => {
    await expect(
      updateCircle(OWNER_ID, CIRCLE_ID, {
        type: "custom",
      } as unknown as UpdateCircleBody)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "CIRCLE_TYPE_IMMUTABLE",
    });

    expect(circleFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects deletion of protected circles", async () => {
    mockCircleTypeLookup("inner");

    await expect(deleteCircle(OWNER_ID, CIRCLE_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: "PROTECTED_CIRCLE_DELETE_FORBIDDEN",
    });

    expect(circleDeleteOneMock).not.toHaveBeenCalled();
    expect(circleMemberDeleteManyMock).not.toHaveBeenCalled();
  });

  it("deletes an owner-authorized custom circle and its memberships", async () => {
    mockCircleTypeLookup("custom");
    circleDeleteOneMock.mockResolvedValue({ deletedCount: 1 });
    circleMemberDeleteManyMock.mockResolvedValue({ deletedCount: 2 });

    await deleteCircle(OWNER_ID, CIRCLE_ID);

    expect(circleFindOneMock).toHaveBeenCalledWith({
      _id: expect.objectContaining({ _bsontype: "ObjectId" }),
      ownerId: expect.objectContaining({ _bsontype: "ObjectId" }),
    });
    expect(circleDeleteOneMock).toHaveBeenCalledWith(
      {
        _id: expect.objectContaining({ _bsontype: "ObjectId" }),
        ownerId: expect.objectContaining({ _bsontype: "ObjectId" }),
        type: "custom",
      },
      { session: transactionSessionMock }
    );
    expect(circleMemberDeleteManyMock).toHaveBeenCalledWith(
      {
        circleId: expect.objectContaining({ _bsontype: "ObjectId" }),
        ownerId: expect.objectContaining({ _bsontype: "ObjectId" }),
      },
      { session: transactionSessionMock }
    );
  });

  it("does not reveal or delete another owner's custom circle", async () => {
    mockCircleTypeLookup(null);

    await expect(deleteCircle(OTHER_OWNER_ID, CIRCLE_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: "CIRCLE_NOT_FOUND",
    });

    expect(circleDeleteOneMock).not.toHaveBeenCalled();
  });
});
