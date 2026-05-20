import { afterEach, describe, expect, it, vi } from "vitest";

const circleCreateMock = vi.hoisted(() => vi.fn());
const circleFindOneMock = vi.hoisted(() => vi.fn());
const circleMemberCreateMock = vi.hoisted(() => vi.fn());
const connectionFindMock = vi.hoisted(() => vi.fn());
const getUsersByIdsMock = vi.hoisted(() => vi.fn());
const transactionSessionMock = vi.hoisted(() => ({ id: "transaction-session" }));

vi.mock("#models/index", () => ({
  Circle: {
    create: circleCreateMock,
    find: vi.fn(),
    findOne: circleFindOneMock,
    findOneAndUpdate: vi.fn(),
  },
  CircleMember: {
    create: circleMemberCreateMock,
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

const { createCircle } = await import("#services/circleService");

const OWNER_ID = "507f1f77bcf86cd799439011";
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
