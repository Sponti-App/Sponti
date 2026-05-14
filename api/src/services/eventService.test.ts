import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const eventCreateMock = vi.hoisted(() => vi.fn());
const eventFindMock = vi.hoisted(() => vi.fn());
const eventMemberCreateMock = vi.hoisted(() => vi.fn());
const eventMemberDistinctMock = vi.hoisted(() => vi.fn());
const eventMemberFindMock = vi.hoisted(() => vi.fn());
const getBlockedRelationshipUserIdsMock = vi.hoisted(() => vi.fn());

vi.mock("#models/index", () => ({
  Block: { exists: vi.fn() },
  Circle: { find: vi.fn() },
  CircleMember: { find: vi.fn() },
  Connection: { find: vi.fn() },
  Event: {
    countDocuments: vi.fn(),
    create: eventCreateMock,
    find: eventFindMock,
    findOne: vi.fn(),
  },
  EventMember: {
    create: eventMemberCreateMock,
    distinct: eventMemberDistinctMock,
    find: eventMemberFindMock,
    findOne: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("#services/blockService", () => ({
  getBlockedInviteeIds: vi.fn(),
  getBlockedRelationshipUserIds: getBlockedRelationshipUserIdsMock,
}));

vi.mock("#utils/transactions", () => ({
  withTransactionFallback: vi.fn((callback: () => unknown) => callback()),
}));

const { createEvent, getActiveMapEvents } = await import("#services/eventService");

const USER_ID = "507f1f77bcf86cd799439011";
const EVENT_ID = "507f1f77bcf86cd799439012";
const NOW = new Date("2026-05-14T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  eventMemberDistinctMock.mockResolvedValue([]);
  getBlockedRelationshipUserIdsMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
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
