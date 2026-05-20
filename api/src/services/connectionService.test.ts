import { afterEach, describe, expect, it, vi } from "vitest";

const connectionCreateMock = vi.hoisted(() => vi.fn());
const connectionFindOneMock = vi.hoisted(() => vi.fn());
const connectionUpdateOneMock = vi.hoisted(() => vi.fn());
const hasAnyBlockBetweenUsersMock = vi.hoisted(() => vi.fn());
const createConnectionAcceptedNotificationMock = vi.hoisted(() => vi.fn());
const createConnectionRequestNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("#models/index", () => ({
  Connection: {
    create: connectionCreateMock,
    findOne: connectionFindOneMock,
    updateOne: connectionUpdateOneMock,
  },
}));

vi.mock("#services/blockService", () => ({
  hasAnyBlockBetweenUsers: hasAnyBlockBetweenUsersMock,
}));

vi.mock("#services/notificationService", () => ({
  createConnectionAcceptedNotification: createConnectionAcceptedNotificationMock,
  createConnectionRequestNotification: createConnectionRequestNotificationMock,
}));

vi.mock("#utils/transactions", () => ({
  withTransactionFallback: vi.fn((callback: () => unknown) => callback()),
}));

const { respondToConnectionRequest, sendConnectionRequest } =
  await import("#services/connectionService");

const REQUESTER_ID = "507f1f77bcf86cd799439011";
const RECEIVER_ID = "507f1f77bcf86cd799439012";
const CONNECTION_ID = "507f1f77bcf86cd799439013";
const RECIPROCAL_CONNECTION_ID = "507f1f77bcf86cd799439014";

afterEach(() => {
  vi.clearAllMocks();
});

const connectionDocument = (
  overrides: Partial<{
    _id: string;
    requesterId: string;
    receiverId: string;
    status: "pending" | "accepted" | "rejected";
    type: "shared_invitation" | "qr" | "email_invitation";
    save: ReturnType<typeof vi.fn>;
  }> = {}
) => ({
  _id: CONNECTION_ID,
  requesterId: REQUESTER_ID,
  receiverId: RECEIVER_ID,
  status: "pending" as const,
  type: "shared_invitation" as const,
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mockFindOneSequence = (values: unknown[]) => {
  connectionFindOneMock.mockImplementation(() => {
    const value = values.shift();
    return { session: vi.fn().mockResolvedValue(value) };
  });
};

describe("connectionService.sendConnectionRequest", () => {
  it("creates one connection_request notification for a newly created pending request", async () => {
    hasAnyBlockBetweenUsersMock.mockResolvedValue(false);
    mockFindOneSequence([null, null]);
    connectionCreateMock.mockResolvedValue([connectionDocument()]);

    await sendConnectionRequest(REQUESTER_ID, {
      receiverId: RECEIVER_ID,
      type: "shared_invitation",
    });

    expect(createConnectionRequestNotificationMock).toHaveBeenCalledOnce();
    expect(createConnectionRequestNotificationMock).toHaveBeenCalledWith({
      requesterId: REQUESTER_ID,
      receiverId: RECEIVER_ID,
      connectionId: CONNECTION_ID,
      session: undefined,
    });
  });

  it("does not create a duplicate notification when the request already exists", async () => {
    hasAnyBlockBetweenUsersMock.mockResolvedValue(false);
    mockFindOneSequence([connectionDocument()]);

    await sendConnectionRequest(REQUESTER_ID, {
      receiverId: RECEIVER_ID,
      type: "shared_invitation",
    });

    expect(connectionCreateMock).not.toHaveBeenCalled();
    expect(createConnectionRequestNotificationMock).not.toHaveBeenCalled();
  });

  it("creates connection_accepted for the original requester on reverse auto-accept", async () => {
    hasAnyBlockBetweenUsersMock.mockResolvedValue(false);
    const reversePending = connectionDocument({
      requesterId: RECEIVER_ID,
      receiverId: REQUESTER_ID,
    });
    mockFindOneSequence([null, reversePending]);
    connectionCreateMock.mockResolvedValue([
      connectionDocument({
        _id: RECIPROCAL_CONNECTION_ID,
        requesterId: REQUESTER_ID,
        receiverId: RECEIVER_ID,
        status: "accepted",
      }),
    ]);

    await sendConnectionRequest(REQUESTER_ID, {
      receiverId: RECEIVER_ID,
      type: "shared_invitation",
    });

    expect(reversePending.save).toHaveBeenCalledOnce();
    expect(createConnectionAcceptedNotificationMock).toHaveBeenCalledOnce();
    expect(createConnectionAcceptedNotificationMock).toHaveBeenCalledWith({
      requesterId: RECEIVER_ID,
      accepterId: REQUESTER_ID,
      connectionId: CONNECTION_ID,
      session: undefined,
    });
  });
});

describe("connectionService.respondToConnectionRequest", () => {
  it("creates connection_accepted when a pending request is accepted", async () => {
    const pending = connectionDocument();
    mockFindOneSequence([pending]);
    connectionUpdateOneMock.mockResolvedValue({ upsertedCount: 1 });

    await respondToConnectionRequest(RECEIVER_ID, CONNECTION_ID, {
      status: "accepted",
    });

    expect(pending.save).toHaveBeenCalledOnce();
    expect(connectionUpdateOneMock).toHaveBeenCalledOnce();
    expect(createConnectionAcceptedNotificationMock).toHaveBeenCalledWith({
      requesterId: REQUESTER_ID,
      accepterId: RECEIVER_ID,
      connectionId: CONNECTION_ID,
      session: undefined,
    });
  });

  it("does not create connection_accepted when a pending request is rejected", async () => {
    const pending = connectionDocument();
    mockFindOneSequence([pending]);

    await respondToConnectionRequest(RECEIVER_ID, CONNECTION_ID, {
      status: "rejected",
    });

    expect(pending.save).toHaveBeenCalledOnce();
    expect(connectionUpdateOneMock).not.toHaveBeenCalled();
    expect(createConnectionAcceptedNotificationMock).not.toHaveBeenCalled();
  });
});
