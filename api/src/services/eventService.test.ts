import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const eventCreateMock = vi.hoisted(() => vi.fn());
const eventCountDocumentsMock = vi.hoisted(() => vi.fn());
const eventFindMock = vi.hoisted(() => vi.fn());
const eventFindOneMock = vi.hoisted(() => vi.fn());
const eventMemberCreateMock = vi.hoisted(() => vi.fn());
const eventMemberDistinctMock = vi.hoisted(() => vi.fn());
const eventMemberFindMock = vi.hoisted(() => vi.fn());
const eventMemberFindOneMock = vi.hoisted(() => vi.fn());
const eventMemberUpdateManyMock = vi.hoisted(() => vi.fn());
const getBlockedRelationshipUserIdsMock = vi.hoisted(() => vi.fn());
const getUsersByIdsMock = vi.hoisted(() => vi.fn());
const notificationCreateMock = vi.hoisted(() => vi.fn());

vi.mock("#models/index", () => ({
  Block: { exists: vi.fn() },
  Circle: { find: vi.fn() },
  CircleMember: { find: vi.fn() },
  Connection: { find: vi.fn() },
  Event: {
    countDocuments: eventCountDocumentsMock,
    create: eventCreateMock,
    find: eventFindMock,
    findOne: eventFindOneMock,
  },
  EventMember: {
    create: eventMemberCreateMock,
    distinct: eventMemberDistinctMock,
    find: eventMemberFindMock,
    findOne: eventMemberFindOneMock,
    updateMany: eventMemberUpdateManyMock,
  },
  Notification: {
    create: notificationCreateMock,
  },
}));

vi.mock("#services/blockService", () => ({
  getBlockedInviteeIds: vi.fn(),
  getBlockedRelationshipUserIds: getBlockedRelationshipUserIdsMock,
}));

vi.mock("#utils/transactions", () => ({
  withTransactionFallback: vi.fn((callback: () => unknown) => callback()),
}));

vi.mock("#services/userDirectoryService", () => ({
  getUsersByIds: getUsersByIdsMock,
}));

const {
  cancelEvent,
  createEvent,
  getActiveMapEvents,
  getEvents,
  getMyUpcomingEvents,
  reactivateEvent,
  updateMyEventMembership,
} = await import("#services/eventService");

const USER_ID = "507f1f77bcf86cd799439011";
const EVENT_ID = "507f1f77bcf86cd799439012";
const GUEST_ID = "507f1f77bcf86cd799439013";
const ADMIN_ID = "507f1f77bcf86cd799439014";
const NOW = new Date("2026-05-14T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  eventMemberDistinctMock.mockResolvedValue([]);
  getBlockedRelationshipUserIdsMock.mockResolvedValue([]);
  getUsersByIdsMock.mockResolvedValue(
    new Map([[GUEST_ID, { _id: GUEST_ID, username: "guest", displayName: "Guest" }]])
  );
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

const mockEventFindOneSelectLean = (event: unknown) => {
  const leanMock = vi.fn().mockResolvedValue(event);
  const selectMock = vi.fn().mockReturnValue({ lean: leanMock });
  eventFindOneMock.mockReturnValue({ select: selectMock });
  return { leanMock, selectMock };
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
});

describe("eventService.cancelEvent", () => {
  it("allows the original host to cancel their event and creates member notifications", async () => {
    const event = eventDocument();
    mockEventFindOneSession(event);
    mockEventMembersForNotifications([
      { userId: USER_ID, rsvpStatus: "going" },
      { userId: GUEST_ID, rsvpStatus: "declined" },
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
    eventMemberFindOneMock.mockResolvedValue(membership);
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
    eventMemberFindOneMock.mockResolvedValue({
      rsvpStatus: "going",
      save: vi.fn().mockResolvedValue(undefined),
    });

    await updateMyEventMembership(GUEST_ID, EVENT_ID, {
      memberWillArriveAt: new Date("2026-05-14T13:10:00.000Z"),
    });

    await updateMyEventMembership(GUEST_ID, EVENT_ID, {
      rsvpStatus: "going",
    });

    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it("does not notify when the host updates their own RSVP", async () => {
    mockEventFindOneSelectLean({
      _id: EVENT_ID,
      hostId: USER_ID,
      title: "coffee after class",
    });
    eventMemberFindOneMock.mockResolvedValue({
      rsvpStatus: "invited",
      save: vi.fn().mockResolvedValue(undefined),
    });

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
