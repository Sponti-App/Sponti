import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const eventMemberFindMock = vi.hoisted(() => vi.fn());
const notificationCountDocumentsMock = vi.hoisted(() => vi.fn());
const notificationCreateMock = vi.hoisted(() => vi.fn());
const notificationFindMock = vi.hoisted(() => vi.fn());
const notificationUpdateManyMock = vi.hoisted(() => vi.fn());
const getUsersByIdsMock = vi.hoisted(() => vi.fn());

vi.mock("#models/index", () => ({
  EventMember: {
    find: eventMemberFindMock,
  },
  Notification: {
    countDocuments: notificationCountDocumentsMock,
    create: notificationCreateMock,
    find: notificationFindMock,
    updateMany: notificationUpdateManyMock,
  },
}));

vi.mock("#services/userDirectoryService", () => ({
  getUsersByIds: getUsersByIdsMock,
}));

const {
  createEventInvitationNotifications,
  createEventStatusNotifications,
  getNotifications,
  markNotificationsReadBatch,
} = await import("#services/notificationService");

const USER_ID = "507f1f77bcf86cd799439011";
const HOST_ID = "507f1f77bcf86cd799439012";
const GUEST_ID = "507f1f77bcf86cd799439013";
const ADMIN_ID = "507f1f77bcf86cd799439014";
const EVENT_ID = "507f1f77bcf86cd799439015";
const NOTIFICATION_ID = "507f1f77bcf86cd799439016";
const OLDER_NOTIFICATION_ID = "507f1f77bcf86cd799439017";
const EXTRA_NOTIFICATION_ID = "507f1f77bcf86cd799439018";

beforeEach(() => {
  getUsersByIdsMock.mockResolvedValue(new Map());
});

afterEach(() => {
  vi.clearAllMocks();
});

const mockNotificationFeed = (docs: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(docs);
  const limitMock = vi.fn().mockReturnValue({ lean: leanMock });
  const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
  notificationFindMock.mockReturnValue({ sort: sortMock });
  return { leanMock, limitMock, sortMock };
};

const mockExistingNotifications = (docs: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(docs);
  const sessionMock = vi.fn().mockReturnValue({ lean: leanMock });
  const selectMock = vi.fn().mockReturnValue({ session: sessionMock });
  notificationFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock, sessionMock };
};

const mockEventMembers = (members: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(members);
  const sessionMock = vi.fn().mockReturnValue({ lean: leanMock });
  const selectMock = vi.fn().mockReturnValue({ session: sessionMock });
  eventMemberFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock, sessionMock };
};

describe("notificationService.getNotifications", () => {
  it("returns newest-first mixed read and unread notifications with a stable next cursor", async () => {
    const now = new Date("2026-05-19T10:00:00.000Z");
    const older = new Date("2026-05-19T09:00:00.000Z");
    const extra = new Date("2026-05-19T08:00:00.000Z");
    const { limitMock, sortMock } = mockNotificationFeed([
      {
        _id: NOTIFICATION_ID,
        userId: USER_ID,
        actorId: HOST_ID,
        type: "event_invitation",
        targetType: "event",
        targetId: EVENT_ID,
        title: "Maya invited you",
        message: "to rooftop drinks",
        readAt: null,
        metadata: { eventTitle: "rooftop drinks" },
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: OLDER_NOTIFICATION_ID,
        userId: USER_ID,
        actorId: null,
        type: "event_cancelled",
        targetType: "event",
        targetId: EVENT_ID,
        title: "Event cancelled",
        message: "rooftop drinks was cancelled.",
        readAt: older,
        metadata: {},
        createdAt: older,
        updatedAt: older,
      },
      {
        _id: EXTRA_NOTIFICATION_ID,
        userId: USER_ID,
        actorId: HOST_ID,
        type: "event_reactivated",
        targetType: "event",
        targetId: EVENT_ID,
        title: "Event reactivated",
        message: "rooftop drinks was reactivated.",
        readAt: null,
        metadata: {},
        createdAt: extra,
        updatedAt: extra,
      },
    ]);
    getUsersByIdsMock.mockResolvedValue(
      new Map([[HOST_ID, { _id: HOST_ID, username: "maya", displayName: "Maya" }]])
    );

    const result = await getNotifications(USER_ID, { limit: 2 });

    expect(notificationFindMock).toHaveBeenCalledWith({
      userId: expect.anything(),
    });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(limitMock).toHaveBeenCalledWith(3);
    expect(result.data.map((notification) => notification._id)).toEqual([
      NOTIFICATION_ID,
      OLDER_NOTIFICATION_ID,
    ]);
    expect(result.data[0]?.readAt).toBeNull();
    expect(result.data[1]?.readAt).toBe(older.toISOString());
    expect(result.data[0]?.actor?.username).toBe("maya");
    expect(result.pagination.nextCursor).toEqual(expect.any(String));
  });

  it("applies a createdAt and id cursor when loading older notifications", async () => {
    const cursorCreatedAt = "2026-05-19T09:00:00.000Z";
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: cursorCreatedAt, id: OLDER_NOTIFICATION_ID })
    ).toString("base64url");
    mockNotificationFeed([]);

    await getNotifications(USER_ID, { limit: 10, cursor });

    const filter = notificationFindMock.mock.calls[0]?.[0] as {
      $or?: Array<Record<string, unknown>>;
    };
    expect(filter.$or).toEqual([
      { createdAt: { $lt: new Date(cursorCreatedAt) } },
      { createdAt: new Date(cursorCreatedAt), _id: { $lt: expect.anything() } },
    ]);
  });
});

describe("notificationService.markNotificationsReadBatch", () => {
  it("marks only the authenticated user's explicit unread notification ids", async () => {
    notificationUpdateManyMock.mockResolvedValue({ modifiedCount: 2 });
    notificationCountDocumentsMock.mockResolvedValue(4);

    const result = await markNotificationsReadBatch(USER_ID, {
      notificationIds: [NOTIFICATION_ID, OLDER_NOTIFICATION_ID, NOTIFICATION_ID],
    });

    const filter = notificationUpdateManyMock.mock.calls[0]?.[0] as {
      _id: { $in: unknown[] };
      readAt: null;
    };
    expect(filter._id.$in).toHaveLength(2);
    expect(filter.readAt).toBeNull();
    expect(String(filter._id.$in[0])).toBe(NOTIFICATION_ID);
    expect(notificationCountDocumentsMock).toHaveBeenCalledWith({
      userId: expect.anything(),
      readAt: null,
    });
    expect(result).toEqual({ markedRead: 2, unreadCount: 4 });
  });
});

describe("notificationService creation helpers", () => {
  it("creates event invitations for deduped concrete invitees and skips existing recipients", async () => {
    mockExistingNotifications([{ userId: ADMIN_ID }]);
    getUsersByIdsMock.mockResolvedValue(
      new Map([[HOST_ID, { _id: HOST_ID, username: "maya", displayName: "Maya" }]])
    );
    notificationCreateMock.mockResolvedValue([{}]);

    await createEventInvitationNotifications({
      eventId: EVENT_ID,
      hostId: HOST_ID,
      eventTitle: "rooftop drinks",
      inviteeIds: [GUEST_ID, GUEST_ID, ADMIN_ID, HOST_ID],
    });

    expect(notificationCreateMock).toHaveBeenCalledOnce();
    const docs = notificationCreateMock.mock.calls[0]?.[0] as Array<{
      userId: unknown;
      type: string;
      targetType: string;
      title: string;
    }>;
    expect(docs).toHaveLength(1);
    expect(String(docs[0]?.userId)).toBe(GUEST_ID);
    expect(docs[0]).toEqual(
      expect.objectContaining({
        type: "event_invitation",
        targetType: "event",
        title: "Maya invited you",
      })
    );
  });

  it("excludes hosts and declined members from cancel/reactivate notifications", async () => {
    mockEventMembers([
      { userId: HOST_ID, rsvpStatus: "going" },
      { userId: GUEST_ID, rsvpStatus: "declined" },
    ]);
    notificationCreateMock.mockResolvedValue([{}]);

    await createEventStatusNotifications({
      eventId: EVENT_ID,
      hostId: HOST_ID,
      eventTitle: "rooftop drinks",
      type: "event_cancelled",
    });

    expect(eventMemberFindMock).toHaveBeenCalledWith({
      eventId: expect.anything(),
      rsvpStatus: { $in: ["invited", "going"] },
    });
    const docs = notificationCreateMock.mock.calls[0]?.[0] as Array<{
      userId: unknown;
      type: string;
    }>;
    expect(docs).toHaveLength(1);
    expect(String(docs[0]?.userId)).toBe(ADMIN_ID);
    expect(docs[0]?.type).toBe("event_cancelled");
  });
});
