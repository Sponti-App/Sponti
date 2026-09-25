import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const eventCreateMock = vi.hoisted(() => vi.fn());
const eventCountDocumentsMock = vi.hoisted(() => vi.fn());
const eventExistsMock = vi.hoisted(() => vi.fn());
const eventFindMock = vi.hoisted(() => vi.fn());
const eventFindOneMock = vi.hoisted(() => vi.fn());
const eventFindOneAndUpdateMock = vi.hoisted(() => vi.fn());
const eventUpdateOneMock = vi.hoisted(() => vi.fn());
const eventMemberBulkWriteMock = vi.hoisted(() => vi.fn());
const eventMemberCreateMock = vi.hoisted(() => vi.fn());
const eventMemberDistinctMock = vi.hoisted(() => vi.fn());
const eventMemberFindMock = vi.hoisted(() => vi.fn());
const eventMemberFindOneMock = vi.hoisted(() => vi.fn());
const eventMemberFindOneAndUpdateMock = vi.hoisted(() => vi.fn());
const eventMemberUpdateManyMock = vi.hoisted(() => vi.fn());
const circleFindMock = vi.hoisted(() => vi.fn());
const circleMemberFindMock = vi.hoisted(() => vi.fn());
const connectionFindMock = vi.hoisted(() => vi.fn());
const getBlockedInviteeIdsMock = vi.hoisted(() => vi.fn());
const getBlockedRelationshipUserIdsMock = vi.hoisted(() => vi.fn());
const getUsersByIdsMock = vi.hoisted(() => vi.fn());
const notificationCreateMock = vi.hoisted(() => vi.fn());
const notificationFindMock = vi.hoisted(() => vi.fn());
const transactionSessionMock = vi.hoisted(() => ({ id: "transaction-session" }));

vi.mock("#models/index", () => ({
  Block: { exists: vi.fn() },
  Circle: { find: circleFindMock },
  CircleMember: { find: circleMemberFindMock },
  Connection: { find: connectionFindMock },
  Event: {
    countDocuments: eventCountDocumentsMock,
    create: eventCreateMock,
    exists: eventExistsMock,
    find: eventFindMock,
    findOne: eventFindOneMock,
    findOneAndUpdate: eventFindOneAndUpdateMock,
    updateOne: eventUpdateOneMock,
  },
  EventMember: {
    bulkWrite: eventMemberBulkWriteMock,
    create: eventMemberCreateMock,
    distinct: eventMemberDistinctMock,
    find: eventMemberFindMock,
    findOne: eventMemberFindOneMock,
    findOneAndUpdate: eventMemberFindOneAndUpdateMock,
    updateMany: eventMemberUpdateManyMock,
  },
  Notification: {
    create: notificationCreateMock,
    find: notificationFindMock,
  },
  // #91: invitation notifications skip invitees who opted out. Nobody has
  // here; the opt-out itself is covered in eventService.db.test.ts.
  NotificationSettings: {
    find: () => ({
      select: () => ({ session: () => ({ lean: async () => [] }) }),
    }),
  },
}));

vi.mock("#services/blockService", () => ({
  getBlockedInviteeIds: getBlockedInviteeIdsMock,
  getBlockedRelationshipUserIds: getBlockedRelationshipUserIdsMock,
}));

vi.mock("#services/userDirectoryService", () => ({
  getUsersByIds: getUsersByIdsMock,
}));

vi.mock("#utils/transactions", () => ({
  withTransactionFallback: vi.fn((callback: (session?: unknown) => unknown) =>
    callback(transactionSessionMock)
  ),
}));

const {
  cancelEvent,
  createEvent,
  getActiveMapEvents,
  getEventById,
  getEventMembers,
  getEvents,
  getMyUpcomingEvents,
  inviteEventMembers,
  reactivateEvent,
  removeEventMember,
  updateMyEventMembership,
} = await import("#services/eventService");

const USER_ID = "507f1f77bcf86cd799439011";
const EVENT_ID = "507f1f77bcf86cd799439012";
const GUEST_ID = "507f1f77bcf86cd799439013";
const ADMIN_ID = "507f1f77bcf86cd799439014";
const CIRCLE_ID = "507f1f77bcf86cd799439015";
const NOW = new Date("2026-05-14T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  eventMemberDistinctMock.mockResolvedValue([]);
  getBlockedInviteeIdsMock.mockResolvedValue(new Set());
  getBlockedRelationshipUserIdsMock.mockResolvedValue([]);
  getUsersByIdsMock.mockResolvedValue(new Map());
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const mockEventFindOneSession = (event: unknown) => {
  const sessionMock = vi.fn().mockResolvedValue(event);
  eventFindOneMock.mockReturnValue({ session: sessionMock });
  return sessionMock;
};

// #181: updateMyEventMembership reserves/releases a "going" spot through
// Event.exists/findOneAndUpdate/updateOne. These tests exercise notification
// behavior, not the guest-limit gate itself (that's covered against a real
// database in eventService.db.test.ts), so default to "already synced,
// reservation granted" and let a membership row resolve via `.session()`.
const mockGoingSpotReservationGranted = () => {
  eventExistsMock.mockReturnValue({ session: vi.fn().mockResolvedValue(true) });
  eventFindOneAndUpdateMock.mockResolvedValue({ _id: EVENT_ID });
  eventUpdateOneMock.mockResolvedValue({ acknowledged: true });
};

const mockEventMemberFindOneSession = (membership: unknown) => {
  const sessionMock = vi.fn().mockResolvedValue(membership);
  eventMemberFindOneMock.mockReturnValue({ session: sessionMock });
  return sessionMock;
};

const mockEventFindOneSelectLean = (event: unknown) => {
  const leanMock = vi.fn().mockResolvedValue(event);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  eventFindOneMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
};

const mockCircleFindLean = (circles: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(circles);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  circleFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
};

const mockCircleMemberFindLean = (members: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(members);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  circleMemberFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
};

const mockAcceptedConnections = (connections: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(connections);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  connectionFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
};

const mockExistingNotifications = (notifications: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(notifications);
  const sessionMock = vi.fn().mockReturnValue({ lean: leanMock });
  const selectMock = vi.fn().mockReturnValue({ session: sessionMock });
  notificationFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock, sessionMock };
};

const mockEventMembersForNotifications = (members: Array<Record<string, unknown>>) => {
  const leanMock = vi.fn().mockResolvedValue(members);
  const sessionMock = vi.fn().mockReturnValue({ lean: leanMock });
  const selectMock = vi.fn().mockReturnValue({ session: sessionMock });
  eventMemberFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock, sessionMock };
};

const mockEventMembersForStats = (members: Array<Record<string, unknown>> = []) => {
  const leanMock = vi.fn().mockResolvedValue(members);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  eventMemberFindMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
};

const eventMemberFindResult = (members: Array<Record<string, unknown>> = []) => {
  const leanMock = vi.fn().mockResolvedValue(members);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  return { select: selectMock };
};

const mockPagedEventFind = (events: Array<Record<string, unknown>> = []) => {
  const leanMock = vi.fn().mockResolvedValue(events);
  const limitMock = vi.fn().mockReturnValue({ lean: leanMock });
  const skipMock = vi.fn().mockReturnValue({ limit: limitMock });
  const sortMock = vi.fn().mockReturnValue({ skip: skipMock });
  eventFindMock.mockReturnValue({ sort: sortMock });
  eventCountDocumentsMock.mockResolvedValue(events.length);
  return { leanMock, limitMock, skipMock, sortMock };
};

const mockSortedEventFind = (events: Array<Record<string, unknown>> = []) => {
  const leanMock = vi.fn().mockResolvedValue(events);
  const sortMock = vi.fn().mockReturnValue({ lean: leanMock });
  return { leanMock, sortMock, query: { sort: sortMock } };
};

const eventDocument = (
  overrides: Partial<{
    _id: string;
    hostId: string;
    title: string;
    status: "active" | "cancelled" | "completed";
    endAt: Date;
    save: ReturnType<typeof vi.fn>;
  }> = {}
) => ({
  _id: EVENT_ID,
  hostId: USER_ID,
  title: "coffee after class",
  status: "active" as const,
  endAt: new Date("2026-05-14T14:00:00.000Z"),
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("eventService.createEvent", () => {
  it("stores the event type provided by the create request", async () => {
    eventCreateMock.mockImplementation(async (docs: Array<Record<string, unknown>>) =>
      docs.map((doc) => ({ _id: EVENT_ID, ...doc }))
    );
    eventMemberCreateMock.mockResolvedValue([]);

    const result = await createEvent(USER_ID, {
      title: "coffee after class",
      description: null,
      type: "drinks",
      startAt: new Date("2026-05-14T13:00:00.000Z"),
      endAt: new Date("2026-05-14T14:00:00.000Z"),
      locationName: "Hamburg",
      locationAddress: "Hamburg, Germany",
      location: { type: "Point", coordinates: [9.9937, 53.5511] },
      visibility: "public",
      allowGuestInvites: "none",
      guestInviteLimit: 0,
      members: [],
      circles: [],
    });

    expect(eventCreateMock).toHaveBeenCalledOnce();
    expect(eventCreateMock.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        title: "coffee after class",
        type: "drinks",
        status: "active",
      }),
    ]);
    expect(result.event.type).toBe("drinks");
  });

  it("creates ordered event-member batches when private circle invitees are expanded", async () => {
    eventCreateMock.mockImplementation(async (docs: Array<Record<string, unknown>>) =>
      docs.map((doc) => ({ _id: EVENT_ID, ...doc }))
    );
    eventMemberCreateMock.mockResolvedValue([]);
    notificationCreateMock.mockResolvedValue([{}, {}]);
    mockCircleFindLean([{ _id: CIRCLE_ID }]);
    mockCircleMemberFindLean([
      { circleId: CIRCLE_ID, userId: GUEST_ID },
      { circleId: CIRCLE_ID, userId: ADMIN_ID },
    ]);
    mockAcceptedConnections([
      { requesterId: USER_ID, receiverId: GUEST_ID },
      { requesterId: USER_ID, receiverId: ADMIN_ID },
    ]);
    mockExistingNotifications([]);

    await createEvent(USER_ID, {
      title: "beer",
      description: null,
      type: "drinks",
      startAt: new Date("2026-05-20T10:30:00.000Z"),
      endAt: new Date("2026-05-20T13:45:00.000Z"),
      locationName: "Saint Pauli",
      locationAddress: "St Pauli, Hamburg, Germany",
      location: { type: "Point", coordinates: [9.9699353, 53.5508628] },
      visibility: "private",
      allowGuestInvites: "none",
      guestInviteLimit: 5,
      members: [],
      circles: [{ circleId: CIRCLE_ID, role: "guest" }],
    });

    expect(eventMemberCreateMock).toHaveBeenCalledOnce();
    expect(eventMemberCreateMock).toHaveBeenCalledWith(expect.any(Array), {
      session: transactionSessionMock,
      ordered: true,
    });
    const docs = eventMemberCreateMock.mock.calls[0]?.[0] as Array<{ userId: unknown }>;
    expect(docs.map((doc) => String(doc.userId))).toEqual([USER_ID, GUEST_ID, ADMIN_ID]);
  });

  // #172: the audience picker now offers custom circles too. Ownership is
  // enforced generically for every circle type — resolveInviteCandidates
  // never looks at `type` — so a circle id the caller doesn't own must be
  // rejected the same way whether it's a system or a custom circle.
  it("rejects a circle the caller doesn't own", async () => {
    // The host asked for CIRCLE_ID, but the owned-circles lookup comes back
    // empty — nothing with that id belongs to this host.
    mockCircleFindLean([]);

    await expect(
      createEvent(USER_ID, {
        title: "beer",
        description: null,
        type: "drinks",
        startAt: new Date("2026-05-20T10:30:00.000Z"),
        endAt: new Date("2026-05-20T13:45:00.000Z"),
        locationName: "Saint Pauli",
        locationAddress: "St Pauli, Hamburg, Germany",
        location: { type: "Point", coordinates: [9.9699353, 53.5508628] },
        visibility: "private",
        allowGuestInvites: "none",
        guestInviteLimit: 5,
        members: [],
        circles: [{ circleId: CIRCLE_ID, role: "guest" }],
      })
    ).rejects.toMatchObject({ statusCode: 404, code: "CIRCLE_NOT_FOUND" });

    expect(eventCreateMock).not.toHaveBeenCalled();
  });
});

describe("eventService.inviteEventMembers", () => {
  const OTHER_GUEST_ID = "507f1f77bcf86cd799439016";

  // The lookup for previously removed members among the people being invited.
  const mockRemovedMembers = (userIds: string[] = []) =>
    mockEventMembersForNotifications(userIds.map((userId) => ({ userId })));

  const mockInvitableEvent = (overrides: Record<string, unknown> = {}) =>
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "friday drinks",
      status: "active",
      endAt: new Date("2026-05-14T14:00:00.000Z"),
      allowGuestInvites: "none",
      ...overrides,
    });

  it("adds new invitees from friends and circles and notifies only the ones added", async () => {
    mockInvitableEvent();
    mockRemovedMembers();
    mockCircleFindLean([{ _id: CIRCLE_ID }]);
    mockCircleMemberFindLean([
      { circleId: CIRCLE_ID, userId: GUEST_ID },
      { circleId: CIRCLE_ID, userId: OTHER_GUEST_ID },
    ]);
    mockAcceptedConnections([
      { requesterId: USER_ID, receiverId: GUEST_ID },
      { requesterId: USER_ID, receiverId: OTHER_GUEST_ID },
      { requesterId: USER_ID, receiverId: ADMIN_ID },
    ]);
    mockExistingNotifications([]);
    notificationCreateMock.mockResolvedValue([{}, {}]);
    // ADMIN_ID (index 0) and OTHER_GUEST_ID (index 2) are new; GUEST_ID was
    // already on the flare, so the upsert matched and inserted nothing.
    eventMemberBulkWriteMock.mockResolvedValue({ upsertedIds: { 0: "m1", 2: "m2" } });

    const result = await inviteEventMembers(USER_ID, EVENT_ID, {
      members: [{ userId: ADMIN_ID, role: "guest" }],
      circles: [{ circleId: CIRCLE_ID, role: "guest" }],
    });

    expect(result).toEqual({ invitedUserIds: [ADMIN_ID, OTHER_GUEST_ID] });
    // The circle the flare went to is remembered on the event.
    expect(eventUpdateOneMock).toHaveBeenCalledWith(
      { _id: EVENT_ID },
      { $addToSet: { invitedCircleIds: { $each: [expect.anything()] } } },
      { session: transactionSessionMock }
    );

    const [ops, options] = eventMemberBulkWriteMock.mock.calls[0] as [
      Array<{ updateOne: { filter: { userId: unknown }; update: unknown; upsert: boolean } }>,
      unknown,
    ];
    expect(ops.map((op) => String(op.updateOne.filter.userId))).toEqual([
      ADMIN_ID,
      GUEST_ID,
      OTHER_GUEST_ID,
    ]);
    expect(ops[0]?.updateOne).toMatchObject({
      upsert: true,
      update: { $setOnInsert: { rsvpStatus: "invited", role: "guest" } },
    });
    expect(options).toEqual({ session: transactionSessionMock, ordered: true });

    const notificationDocs = notificationCreateMock.mock.calls[0]?.[0] as Array<{
      userId: unknown;
      type: string;
    }>;
    expect(notificationDocs.map((doc) => String(doc.userId))).toEqual([ADMIN_ID, OTHER_GUEST_ID]);
    expect(notificationDocs.every((doc) => doc.type === "event_invitation")).toBe(true);
  });

  it("sends no notifications when everyone picked is already on the flare", async () => {
    mockInvitableEvent();
    mockRemovedMembers();
    mockAcceptedConnections([{ requesterId: USER_ID, receiverId: GUEST_ID }]);
    eventMemberBulkWriteMock.mockResolvedValue({ upsertedIds: {} });

    const result = await inviteEventMembers(USER_ID, EVENT_ID, {
      members: [{ userId: GUEST_ID, role: "guest" }],
      circles: [],
    });

    expect(result).toEqual({ invitedUserIds: [] });
    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller is not the host", async () => {
    mockEventFindOneSelectLean(null);

    await expect(
      inviteEventMembers(GUEST_ID, EVENT_ID, {
        members: [{ userId: ADMIN_ID, role: "guest" }],
        circles: [],
      })
    ).rejects.toMatchObject({ statusCode: 404, code: "EVENT_NOT_FOUND" });
    expect(eventMemberBulkWriteMock).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled", { status: "cancelled" }],
    ["ended", { endAt: new Date("2026-05-14T11:00:00.000Z") }],
  ])("rejects invites to a %s flare", async (_label, overrides) => {
    mockInvitableEvent(overrides);

    await expect(
      inviteEventMembers(USER_ID, EVENT_ID, {
        members: [{ userId: GUEST_ID, role: "guest" }],
        circles: [],
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "EVENT_NOT_INVITABLE" });
    expect(eventMemberBulkWriteMock).not.toHaveBeenCalled();
  });

  it("rejects people who aren't accepted connections, as on create", async () => {
    mockInvitableEvent();
    mockAcceptedConnections([]);

    await expect(
      inviteEventMembers(USER_ID, EVENT_ID, {
        members: [{ userId: GUEST_ID, role: "guest" }],
        circles: [],
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "EVENT_INVITEE_NOT_ACCEPTED_CONNECTION" });
    expect(eventMemberBulkWriteMock).not.toHaveBeenCalled();
  });

  it("silently skips blocked users and never invites the host", async () => {
    mockInvitableEvent();
    getBlockedInviteeIdsMock.mockResolvedValue(new Set([GUEST_ID]));

    const result = await inviteEventMembers(USER_ID, EVENT_ID, {
      members: [
        { userId: GUEST_ID, role: "guest" },
        { userId: USER_ID, role: "guest" },
      ],
      circles: [],
    });

    expect(result).toEqual({ invitedUserIds: [] });
    expect(eventMemberBulkWriteMock).not.toHaveBeenCalled();
  });
});

describe("eventService.inviteEventMembers restoring removed guests", () => {
  it("restores a removed guest as a fresh invitee and notifies them again", async () => {
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "friday drinks",
      status: "active",
      endAt: new Date("2026-05-14T14:00:00.000Z"),
      allowGuestInvites: "none",
    });
    mockEventMembersForNotifications([{ userId: GUEST_ID }]);
    mockAcceptedConnections([{ requesterId: USER_ID, receiverId: GUEST_ID }]);
    mockExistingNotifications([]);
    notificationCreateMock.mockResolvedValue([{}]);
    eventMemberUpdateManyMock.mockResolvedValue({ modifiedCount: 1 });
    // The row already exists (it was only marked removed), so nothing is inserted.
    eventMemberBulkWriteMock.mockResolvedValue({ upsertedIds: {} });

    const result = await inviteEventMembers(USER_ID, EVENT_ID, {
      members: [{ userId: GUEST_ID, role: "guest" }],
      circles: [],
    });

    expect(result).toEqual({ invitedUserIds: [GUEST_ID] });
    expect(eventMemberUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ removedAt: { $ne: null } }),
      {
        $set: expect.objectContaining({
          removedAt: null,
          rsvpStatus: "invited",
          memberWillArriveAt: null,
        }),
      },
      { session: transactionSessionMock }
    );
    // Restored people are notified even though they already had an invite notice.
    expect(notificationFindMock).not.toHaveBeenCalled();
    expect(notificationCreateMock).toHaveBeenCalledOnce();
  });
});

describe("eventService circles remembered on flares (#150)", () => {
  it("stores the circles a new private flare was sent to", async () => {
    eventCreateMock.mockImplementation(async (docs: Array<Record<string, unknown>>) =>
      docs.map((doc) => ({ _id: EVENT_ID, ...doc }))
    );
    eventMemberCreateMock.mockResolvedValue([]);
    mockCircleFindLean([{ _id: CIRCLE_ID }]);
    mockCircleMemberFindLean([]);
    mockAcceptedConnections([]);

    await createEvent(USER_ID, {
      title: "beer",
      description: null,
      type: "drinks",
      startAt: new Date("2026-05-20T10:30:00.000Z"),
      endAt: new Date("2026-05-20T13:45:00.000Z"),
      locationName: "Saint Pauli",
      locationAddress: null,
      location: { type: "Point", coordinates: [9.97, 53.55] },
      visibility: "private",
      allowGuestInvites: "none",
      guestInviteLimit: 5,
      members: [],
      // Listed twice on purpose: it should be stored once.
      circles: [
        { circleId: CIRCLE_ID, role: "guest" },
        { circleId: CIRCLE_ID, role: "guest" },
      ],
    });

    const [docs] = eventCreateMock.mock.calls[0] as [Array<{ invitedCircleIds: unknown[] }>];
    expect(docs[0]?.invitedCircleIds.map(String)).toEqual([CIRCLE_ID]);
  });

  it("stores no circles for a public flare", async () => {
    eventCreateMock.mockImplementation(async (docs: Array<Record<string, unknown>>) =>
      docs.map((doc) => ({ _id: EVENT_ID, ...doc }))
    );
    eventMemberCreateMock.mockResolvedValue([]);

    await createEvent(USER_ID, {
      title: "open jam",
      description: null,
      type: "hangout",
      startAt: new Date("2026-05-20T10:30:00.000Z"),
      endAt: new Date("2026-05-20T13:45:00.000Z"),
      locationName: "Park",
      locationAddress: null,
      location: { type: "Point", coordinates: [9.97, 53.55] },
      visibility: "public",
      allowGuestInvites: "none",
      guestInviteLimit: 0,
      members: [],
      circles: [{ circleId: CIRCLE_ID, role: "guest" }],
    });

    const [docs] = eventCreateMock.mock.calls[0] as [Array<{ invitedCircleIds: unknown[] }>];
    expect(docs[0]?.invitedCircleIds).toEqual([]);
  });

  it("remembers the circle even when inviting it adds nobody", async () => {
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "friday drinks",
      status: "active",
      endAt: new Date("2026-05-14T14:00:00.000Z"),
      allowGuestInvites: "none",
    });
    mockCircleFindLean([{ _id: CIRCLE_ID }]);
    mockCircleMemberFindLean([]); // an empty circle

    const result = await inviteEventMembers(USER_ID, EVENT_ID, {
      members: [],
      circles: [{ circleId: CIRCLE_ID, role: "guest" }],
    });

    expect(result).toEqual({ invitedUserIds: [] });
    expect(eventUpdateOneMock).toHaveBeenCalledWith(
      { _id: EVENT_ID },
      { $addToSet: { invitedCircleIds: { $each: [expect.anything()] } } },
      { session: undefined }
    );
    expect(eventMemberBulkWriteMock).not.toHaveBeenCalled();
  });
});

describe("eventService.removeEventMember", () => {
  const removableEvent = (overrides: Record<string, unknown> = {}) =>
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "friday drinks",
      status: "active",
      startAt: new Date("2026-05-15T18:00:00.000Z"),
      ...overrides,
    });

  it("removes a going guest and sends them one neutral notice that doesn't name the host", async () => {
    removableEvent();
    eventMemberFindOneAndUpdateMock.mockResolvedValue({ rsvpStatus: "going" });
    notificationCreateMock.mockResolvedValue([{}]);

    const result = await removeEventMember(USER_ID, EVENT_ID, GUEST_ID);

    expect(result).toEqual({ removedUserId: GUEST_ID, notified: true });
    expect(eventMemberFindOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: { $ne: "host" }, removedAt: null }),
      { $set: { removedAt: expect.any(Date) } },
      { session: transactionSessionMock, returnDocument: "before" }
    );
    const docs = notificationCreateMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      type: "event_guest_removed",
      actorId: null,
      title: "You're no longer on the guest list",
      message: "for friday drinks",
    });
    expect(String(docs[0]?.userId)).toBe(GUEST_ID);
  });

  it.each(["invited", "declined"])("removes a %s guest without telling them", async (rsvp) => {
    removableEvent();
    eventMemberFindOneAndUpdateMock.mockResolvedValue({ rsvpStatus: rsvp });

    const result = await removeEventMember(USER_ID, EVENT_ID, GUEST_ID);

    expect(result).toEqual({ removedUserId: GUEST_ID, notified: false });
    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the guest isn't on the flare or was already removed", async () => {
    removableEvent();
    eventMemberFindOneAndUpdateMock.mockResolvedValue(null);

    await expect(removeEventMember(USER_ID, EVENT_ID, GUEST_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: "EVENT_MEMBER_NOT_FOUND",
    });
    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it("returns 404 to anyone but the host", async () => {
    mockEventFindOneSelectLean(null);

    await expect(removeEventMember(GUEST_ID, EVENT_ID, ADMIN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: "EVENT_NOT_FOUND",
    });
    expect(eventMemberFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("refuses to remove the host", async () => {
    await expect(removeEventMember(USER_ID, EVENT_ID, USER_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: "CANNOT_REMOVE_HOST",
    });
    expect(eventFindOneMock).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled", { status: "cancelled" }],
    ["already started", { startAt: new Date("2026-05-14T11:00:00.000Z") }],
  ])("locks the guest list once the flare is %s", async (_label, overrides) => {
    removableEvent(overrides);

    await expect(removeEventMember(USER_ID, EVENT_ID, GUEST_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: "EVENT_GUEST_LIST_LOCKED",
    });
    expect(eventMemberFindOneAndUpdateMock).not.toHaveBeenCalled();
  });
});

describe("eventService visibility for removed guests", () => {
  it("excludes flares a guest was removed from, even public ones", async () => {
    const removedEventId = "507f1f77bcf86cd799439099";
    eventMemberDistinctMock
      .mockResolvedValueOnce([]) // events they're a member of
      .mockResolvedValueOnce([removedEventId]); // events they were removed from
    mockPagedEventFind([]);

    await getEvents(GUEST_ID, { page: 1, limit: 20 } as never);

    const filter = eventFindMock.mock.calls[0]?.[0] as { $and: Array<Record<string, unknown>> };
    expect(eventMemberDistinctMock).toHaveBeenCalledWith("eventId", {
      userId: expect.anything(),
      removedAt: { $ne: null },
    });
    expect(JSON.stringify(filter)).toContain(removedEventId);
    expect(JSON.stringify(filter)).toContain("$nin");
  });
});

describe("eventService.getEventMembers", () => {
  const mockMemberFind = (members: Array<Record<string, unknown>>) => {
    const leanMock = vi.fn().mockResolvedValue(members);
    const sortMock = vi.fn().mockReturnValue({ lean: leanMock });
    const selectMock = vi.fn().mockReturnValue({ sort: sortMock });
    eventMemberFindMock.mockReturnValue({ select: selectMock });
  };

  it("returns the guest list with identities and RSVPs, excluding the host", async () => {
    mockEventFindOneSelectLean({ _id: EVENT_ID });
    mockMemberFind([
      { userId: GUEST_ID, role: "guest", rsvpStatus: "going", invitedBy: USER_ID },
      // No invitedBy: this guest joined a public flare on their own.
      { userId: ADMIN_ID, role: "admin", rsvpStatus: "invited", invitedBy: null },
    ]);
    getUsersByIdsMock.mockResolvedValue(
      new Map([[GUEST_ID, { _id: GUEST_ID, displayName: "sam", username: "sam" }]])
    );

    const result = await getEventMembers(USER_ID, EVENT_ID);

    expect(eventMemberFindMock).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      role: { $ne: "host" },
      removedAt: null,
    });
    expect(result).toEqual([
      {
        user: { _id: GUEST_ID, displayName: "sam", username: "sam", avatarUrl: null },
        role: "guest",
        rsvpStatus: "going",
        joinedWithoutInvite: false,
      },
      {
        user: { _id: ADMIN_ID, displayName: "guest", username: undefined, avatarUrl: null },
        role: "admin",
        rsvpStatus: "invited",
        joinedWithoutInvite: true,
      },
    ]);
  });

  it("returns 404 to anyone but the host", async () => {
    mockEventFindOneSelectLean(null);

    await expect(getEventMembers(GUEST_ID, EVENT_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: "EVENT_NOT_FOUND",
    });
    expect(eventMemberFindMock).not.toHaveBeenCalled();
  });
});

describe("eventService.cancelEvent", () => {
  it("allows the original host to cancel their event and creates member notifications", async () => {
    const event = eventDocument();
    mockEventFindOneSession(event);
    mockEventMembersForNotifications([
      { userId: USER_ID, rsvpStatus: "going" },
      { userId: GUEST_ID, rsvpStatus: "declined" },
      { userId: ADMIN_ID, rsvpStatus: "going" },
    ]);
    notificationCreateMock.mockResolvedValue([]);

    const result = await cancelEvent(USER_ID, EVENT_ID);

    expect(result).toBe(event);
    expect(event.status).toBe("cancelled");
    expect(event.save).toHaveBeenCalledOnce();
    expect(eventMemberUpdateManyMock).not.toHaveBeenCalled();
    expect(notificationCreateMock).toHaveBeenCalledOnce();
    const docs = notificationCreateMock.mock.calls[0]?.[0] as Array<{
      userId: unknown;
      actorId: unknown;
      type: string;
      targetType: string;
    }>;
    expect(docs).toHaveLength(1);
    expect(String(docs[0]?.userId)).toBe(ADMIN_ID);
    expect(docs[0]).toEqual(
      expect.objectContaining({
        actorId: expect.anything(),
        type: "event_cancelled",
        targetType: "event",
      })
    );
  });

  it("rejects an admin member who is not the host", async () => {
    mockEventFindOneSession(eventDocument({ hostId: USER_ID }));

    await expect(cancelEvent(ADMIN_ID, EVENT_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: "EVENT_CANCEL_FORBIDDEN",
    });

    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a guest member who is not the host", async () => {
    mockEventFindOneSession(eventDocument({ hostId: USER_ID }));

    await expect(cancelEvent(GUEST_ID, EVENT_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: "EVENT_CANCEL_FORBIDDEN",
    });

    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the event does not exist", async () => {
    mockEventFindOneSession(null);

    await expect(cancelEvent(USER_ID, EVENT_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: "EVENT_NOT_FOUND",
    });
  });

  it("is idempotent when the event is already cancelled", async () => {
    const event = eventDocument({ status: "cancelled" });
    mockEventFindOneSession(event);

    const result = await cancelEvent(USER_ID, EVENT_ID);

    expect(result).toBe(event);
    expect(event.save).not.toHaveBeenCalled();
    expect(notificationCreateMock).not.toHaveBeenCalled();
    expect(eventMemberUpdateManyMock).not.toHaveBeenCalled();
  });
});

describe("eventService.reactivateEvent", () => {
  it("allows the original host to reactivate an upcoming cancelled event", async () => {
    const event = eventDocument({ status: "cancelled" });
    mockEventFindOneSession(event);
    mockEventMembersForNotifications([
      { userId: USER_ID, rsvpStatus: "going" },
      { userId: GUEST_ID, rsvpStatus: "declined" },
      { userId: ADMIN_ID, rsvpStatus: "going" },
    ]);
    notificationCreateMock.mockResolvedValue([]);

    const result = await reactivateEvent(USER_ID, EVENT_ID);

    expect(result).toBe(event);
    expect(event.status).toBe("active");
    expect(event.save).toHaveBeenCalledOnce();
    const docs = notificationCreateMock.mock.calls[0]?.[0] as Array<{
      userId: unknown;
      type: string;
      targetType: string;
    }>;
    expect(docs).toHaveLength(1);
    expect(String(docs[0]?.userId)).toBe(ADMIN_ID);
    expect(docs[0]).toEqual(
      expect.objectContaining({
        type: "event_reactivated",
        targetType: "event",
      })
    );
  });
});

describe("eventService.updateMyEventMembership", () => {
  it("creates an RSVP notification only when the RSVP status actually changes", async () => {
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "coffee after class",
    });
    const membership = {
      rsvpStatus: "invited",
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockEventMemberFindOneSession(membership);
    mockGoingSpotReservationGranted();
    notificationCreateMock.mockResolvedValue([{}]);

    await updateMyEventMembership(GUEST_ID, EVENT_ID, {
      rsvpStatus: "going",
    });

    expect(membership.rsvpStatus).toBe("going");
    expect(membership.save).toHaveBeenCalledOnce();
    expect(notificationCreateMock).toHaveBeenCalledOnce();
    const docs = notificationCreateMock.mock.calls[0]?.[0] as Array<{
      userId: unknown;
      actorId: unknown;
      type: string;
      metadata: { rsvpStatus?: string };
    }>;
    expect(String(docs[0]?.userId)).toBe(USER_ID);
    expect(String(docs[0]?.actorId)).toBe(GUEST_ID);
    expect(docs[0]).toEqual(
      expect.objectContaining({
        type: "event_rsvp_change",
        metadata: expect.objectContaining({ rsvpStatus: "going" }),
      })
    );
  });

  it("does not create an RSVP notification for ETA-only or unchanged RSVP updates", async () => {
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "coffee after class",
    });
    mockEventMemberFindOneSession({
      rsvpStatus: "going",
      save: vi.fn().mockResolvedValue(undefined),
    });
    mockGoingSpotReservationGranted();

    await updateMyEventMembership(GUEST_ID, EVENT_ID, {
      memberWillArriveAt: new Date("2026-05-14T13:10:00.000Z"),
    });

    await updateMyEventMembership(GUEST_ID, EVENT_ID, {
      rsvpStatus: "going",
    });

    expect(notificationCreateMock).not.toHaveBeenCalled();
    // Neither call transitioned into `going` (already going both times), so
    // no spot should have been reserved either.
    expect(eventFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("does not notify when the host updates their own RSVP", async () => {
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "coffee after class",
    });
    mockEventMemberFindOneSession({
      rsvpStatus: "invited",
      save: vi.fn().mockResolvedValue(undefined),
    });
    mockGoingSpotReservationGranted();

    await updateMyEventMembership(USER_ID, EVENT_ID, {
      rsvpStatus: "going",
    });

    expect(notificationCreateMock).not.toHaveBeenCalled();
  });
});

describe("eventService.getEvents", () => {
  it("uses the authenticated user id for hostedByMe and applies active/endAt filters", async () => {
    mockPagedEventFind();
    const endAtFrom = new Date("2026-05-14T12:30:00.000Z");

    await getEvents(USER_ID, {
      page: 1,
      limit: 20,
      hostedByMe: true,
      status: "active",
      endAtFrom,
    });

    expect(eventFindMock).toHaveBeenCalledOnce();
    const filter = eventFindMock.mock.calls[0]?.[0] as {
      $and: Array<Record<string, unknown>>;
    };
    const hostedCondition = filter.$and.find((condition) => "hostId" in condition) as {
      hostId?: unknown;
    };
    const endAtCondition = filter.$and.find((condition) => "endAt" in condition) as {
      endAt?: { $gt?: Date };
    };

    expect(String(hostedCondition.hostId)).toBe(USER_ID);
    expect(filter.$and).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "active" })])
    );
    expect(endAtCondition.endAt?.$gt).toEqual(endAtFrom);
  });
});

describe("eventService.getEventById", () => {
  it("returns host identity and going guest identities for detail surfaces", async () => {
    const event = eventDocument();
    const leanMock = vi.fn().mockResolvedValue(event);
    eventFindOneMock.mockReturnValue({ lean: leanMock });
    eventMemberFindMock
      .mockReturnValueOnce(
        eventMemberFindResult([
          { eventId: EVENT_ID, rsvpStatus: "going" },
          { eventId: EVENT_ID, rsvpStatus: "invited" },
        ])
      )
      .mockReturnValueOnce(eventMemberFindResult([{ eventId: EVENT_ID, rsvpStatus: "going" }]))
      .mockReturnValueOnce(
        eventMemberFindResult([
          { eventId: EVENT_ID, userId: USER_ID },
          { eventId: EVENT_ID, userId: GUEST_ID },
        ])
      );
    getUsersByIdsMock.mockResolvedValue(
      new Map([
        [
          USER_ID,
          {
            _id: USER_ID,
            username: "martin",
            displayName: "Martin",
            avatarUrl: null,
          },
        ],
        [
          GUEST_ID,
          {
            _id: GUEST_ID,
            username: "alex",
            displayName: "Alex",
            avatarUrl: null,
          },
        ],
      ])
    );

    const result = await getEventById(USER_ID, EVENT_ID);

    expect(result.hostId).toEqual({
      _id: USER_ID,
      username: "martin",
      displayName: "Martin",
      avatarUrl: null,
    });
    expect(result.attendees).toEqual([
      {
        _id: GUEST_ID,
        username: "alex",
        displayName: "Alex",
        avatarUrl: null,
      },
    ]);
  });
});

describe("eventService.getMyUpcomingEvents", () => {
  it("returns only hosted past events from the last two weeks in the past bucket", async () => {
    const hosted = mockSortedEventFind();
    const invited = mockSortedEventFind();
    const past = mockSortedEventFind();
    eventFindMock
      .mockReturnValueOnce(hosted.query)
      .mockReturnValueOnce(invited.query)
      .mockReturnValueOnce(past.query);
    mockEventMembersForStats();

    await getMyUpcomingEvents(USER_ID, { endAtFrom: NOW });

    expect(eventFindMock).toHaveBeenCalledTimes(3);
    const hostedFilter = eventFindMock.mock.calls[0]?.[0] as {
      hostId?: unknown;
      status?: { $in?: string[] };
      endAt?: { $gt?: Date };
    };
    const invitedFilter = eventFindMock.mock.calls[1]?.[0] as {
      status?: string;
      endAt?: { $gt?: Date };
    };
    const pastFilter = eventFindMock.mock.calls[2]?.[0] as {
      hostId?: unknown;
      endAt?: { $lte?: Date; $gte?: Date };
    };

    expect(String(hostedFilter.hostId)).toBe(USER_ID);
    expect(hostedFilter.status?.$in).toEqual(["active", "cancelled"]);
    expect(hostedFilter.endAt?.$gt).toEqual(NOW);
    expect(invitedFilter.status).toBe("active");
    expect(invitedFilter.endAt?.$gt).toEqual(NOW);
    expect(String(pastFilter.hostId)).toBe(USER_ID);
    expect(pastFilter.endAt?.$lte).toEqual(NOW);
    expect(pastFilter.endAt?.$gte).toEqual(new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000));
  });
});

describe("eventService.getActiveMapEvents", () => {
  beforeEach(() => {
    const leanMock = vi.fn().mockResolvedValue([]);
    const limitMock = vi.fn().mockReturnValue({ lean: leanMock });
    const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
    eventFindMock.mockReturnValue({ sort: sortMock });
  });

  it("excludes events that have already ended from the map query", async () => {
    await getActiveMapEvents(USER_ID, {
      lat: 53.5511,
      lng: 9.9937,
      radiusKm: 25,
    });

    expect(eventFindMock).toHaveBeenCalledOnce();

    const filter = eventFindMock.mock.calls[0]?.[0] as {
      $and: [
        Record<string, unknown>,
        {
          status: string;
          endAt: { $gt: Date };
          location: {
            $near: {
              $geometry: { type: string; coordinates: [number, number] };
              $maxDistance: number;
            };
          };
        },
      ];
    };
    const mapCondition = filter.$and[1];

    expect(mapCondition.status).toBe("active");
    expect(mapCondition.endAt.$gt).toBeInstanceOf(Date);
    expect(mapCondition.endAt.$gt.getTime()).toBe(NOW.getTime());
    expect(mapCondition.location.$near.$geometry).toEqual({
      type: "Point",
      coordinates: [9.9937, 53.5511],
    });
    expect(mapCondition.location.$near.$maxDistance).toBe(25_000);
  });

  it("returns the stored event type for active map events", async () => {
    const mapEvent = {
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "coffee after class",
      type: "drinks",
      startAt: new Date("2026-05-14T13:00:00.000Z"),
      endAt: new Date("2026-05-14T14:00:00.000Z"),
      locationName: "Hamburg",
      locationAddress: "Hamburg, Germany",
      location: { type: "Point", coordinates: [9.9937, 53.5511] },
      visibility: "public",
      allowGuestInvites: "none",
      guestInviteLimit: 0,
      status: "active",
    };
    const leanEventsMock = vi.fn().mockResolvedValue([mapEvent]);
    const limitMock = vi.fn().mockReturnValue({ lean: leanEventsMock });
    const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
    eventFindMock.mockReturnValue({ sort: sortMock });
    const leanMembershipsMock = vi.fn().mockResolvedValue([]);
    const selectMock = vi.fn().mockReturnValue({ lean: leanMembershipsMock });
    eventMemberFindMock.mockReturnValue({ select: selectMock });

    const events = await getActiveMapEvents(USER_ID, {
      lat: 53.5511,
      lng: 9.9937,
      radiusKm: 25,
    });

    expect(events[0]?.type).toBe("drinks");
  });
});
