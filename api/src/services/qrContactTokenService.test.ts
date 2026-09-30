import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const connectionFindMock = vi.hoisted(() => vi.fn());
const qrCreateMock = vi.hoisted(() => vi.fn());
const qrFindOneMock = vi.hoisted(() => vi.fn());
const qrUpdateOneMock = vi.hoisted(() => vi.fn());
const getUsersByIdsMock = vi.hoisted(() => vi.fn());
const hasAnyBlockBetweenUsersMock = vi.hoisted(() => vi.fn());
const connectInPersonMock = vi.hoisted(() => vi.fn());

vi.mock("#models/index", () => ({
  Connection: {
    find: connectionFindMock,
  },
  QrContactToken: {
    create: qrCreateMock,
    findOne: qrFindOneMock,
    updateOne: qrUpdateOneMock,
  },
}));

vi.mock("#services/blockService", () => ({
  hasAnyBlockBetweenUsers: hasAnyBlockBetweenUsersMock,
}));

vi.mock("#services/connectionService", () => ({
  connectInPerson: connectInPersonMock,
}));

vi.mock("#services/userDirectoryService", () => ({
  getUsersByIds: getUsersByIdsMock,
}));

const { createQrContactToken, resolveQrContactToken } = await import(
  "#services/qrContactTokenService"
);

const OWNER_ID = "507f1f77bcf86cd799439011";
const VIEWER_ID = "507f1f77bcf86cd799439012";
const TOKEN_ID = "507f1f77bcf86cd799439013";
const NOW = new Date("2026-05-18T12:00:00.000Z");

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function mockToken(rawToken: string, expiresAt = new Date("2026-05-18T12:10:00.000Z")) {
  qrFindOneMock.mockReturnValue({
    lean: vi.fn().mockResolvedValue({
      _id: new Types.ObjectId(TOKEN_ID),
      userId: new Types.ObjectId(OWNER_ID),
      tokenHash: hashToken(rawToken),
      expiresAt,
      isActive: true,
    }),
  });
}

function mockConnections(connections: Array<Record<string, unknown>> = []) {
  connectionFindMock.mockReturnValue({
    lean: vi.fn().mockResolvedValue(connections),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  qrCreateMock.mockResolvedValue({});
  qrUpdateOneMock.mockResolvedValue({});
  hasAnyBlockBetweenUsersMock.mockResolvedValue(false);
  getUsersByIdsMock.mockResolvedValue(
    new Map([
      [
        OWNER_ID,
        {
          _id: OWNER_ID,
          username: "alex",
          displayName: "Alex Kim",
          avatarUrl: "https://example.com/avatar.png",
        },
      ],
    ])
  );
  mockConnections();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("qrContactTokenService.createQrContactToken", () => {
  it("issues a hashed token without exposing the raw value at rest", async () => {
    const result = await createQrContactToken(OWNER_ID);

    expect(result.token).toEqual(expect.any(String));
    expect(result.expiresAt.toISOString()).toBe("2026-05-18T12:15:00.000Z");
    expect(result.expiresInSeconds).toBe(900);
    expect(qrCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: new Types.ObjectId(OWNER_ID),
        tokenHash: hashToken(result.token),
        isActive: true,
      })
    );
    expect(qrCreateMock.mock.calls[0]?.[0]).not.toMatchObject({ token: result.token });
  });
});

describe("qrContactTokenService.resolveQrContactToken", () => {
  it("returns a confirmation payload without creating a connection by default", async () => {
    mockToken("raw-token");

    const result = await resolveQrContactToken(VIEWER_ID, {
      token: "raw-token",
      connect: false,
    });

    expect(result).toMatchObject({
      profile: {
        id: OWNER_ID,
        username: "alex",
        displayName: "Alex Kim",
        avatarUrl: "https://example.com/avatar.png",
      },
      relationship: "none",
      canConnect: true,
      connection: null,
    });
    expect(connectInPersonMock).not.toHaveBeenCalled();
  });

  it("connects instantly (no request step) only when connect is confirmed", async () => {
    mockToken("raw-token");
    connectInPersonMock.mockResolvedValue({
      processed: true,
      delivered: true,
      connected: true,
      created: true,
    });

    const result = await resolveQrContactToken(VIEWER_ID, {
      token: "raw-token",
      connect: true,
    });

    expect(connectInPersonMock).toHaveBeenCalledWith(VIEWER_ID, OWNER_ID);
    expect(result.connection).toEqual({
      processed: true,
      delivered: true,
      autoAccepted: true,
    });
  });

  it("lets a scan resolve the viewer's own pending request too", async () => {
    mockToken("raw-token");
    mockConnections([
      {
        requesterId: new Types.ObjectId(VIEWER_ID),
        receiverId: new Types.ObjectId(OWNER_ID),
        status: "pending",
      },
    ]);

    const result = await resolveQrContactToken(VIEWER_ID, {
      token: "raw-token",
      connect: false,
    });

    expect(result.relationship).toBe("pending_outgoing");
    expect(result.canConnect).toBe(true);
  });

  it("does not mutate on self-scan", async () => {
    mockToken("raw-token");

    const result = await resolveQrContactToken(OWNER_ID, {
      token: "raw-token",
      connect: true,
    });

    expect(result.relationship).toBe("self");
    expect(result.canConnect).toBe(false);
    expect(connectInPersonMock).not.toHaveBeenCalled();
    expect(hasAnyBlockBetweenUsersMock).not.toHaveBeenCalled();
  });

  it("uses a generic not-found error when either user has blocked the other", async () => {
    mockToken("raw-token");
    hasAnyBlockBetweenUsersMock.mockResolvedValue(true);

    await expect(
      resolveQrContactToken(VIEWER_ID, {
        token: "raw-token",
        connect: false,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "QR_CONTACT_TOKEN_NOT_FOUND",
    });

    expect(getUsersByIdsMock).not.toHaveBeenCalled();
    expect(connectInPersonMock).not.toHaveBeenCalled();
  });

  it("deactivates expired tokens and returns a gone error", async () => {
    mockToken("raw-token", new Date("2026-05-18T11:59:59.000Z"));

    await expect(
      resolveQrContactToken(VIEWER_ID, {
        token: "raw-token",
        connect: false,
      })
    ).rejects.toMatchObject({
      statusCode: 410,
      code: "QR_CONTACT_TOKEN_EXPIRED",
    });

    expect(qrUpdateOneMock).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(TOKEN_ID) },
      { $set: { isActive: false } }
    );
  });
});
