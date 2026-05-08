import { type ClientSession } from "mongoose";
import { Block, Circle, CircleMember, Event, EventMember } from "#models/index";
import type {
  ActiveMapEventsQuery,
  CreateEventBody,
  GetEventsQuery,
  UpcomingCalendarEventsQuery,
  UpdateEventBody,
  UpdateMyEventMembershipBody,
} from "#schemas/eventSchemas";
import { getBlockedInviteeIds, getBlockedRelationshipUserIds } from "#services/blockService";
import { notificationHooks } from "#services/notificationHookService";
import { AppError } from "#utils/AppError";
import { toObjectId, uniqueObjectIdStrings } from "#utils/objectId";
import { getPagination, toPagination } from "#utils/pagination";
import { withTransactionFallback } from "#utils/transactions";

type EventFilter = Record<string, unknown>;
type InviteRole = "admin" | "guest";
type InviteCandidate = {
  userId: string;
  role: InviteRole;
  canInviteGuests: boolean;
};

const roleRank: Record<InviteRole, number> = {
  guest: 1,
  admin: 2,
};

const mergeInviteCandidate = (
  candidates: Map<string, InviteCandidate>,
  candidate: InviteCandidate
) => {
  const existing = candidates.get(candidate.userId);

  if (!existing || roleRank[candidate.role] > roleRank[existing.role]) {
    candidates.set(candidate.userId, candidate);
    return;
  }

  if (existing && candidate.canInviteGuests) {
    existing.canInviteGuests = true;
  }
};

const withConditions = (base: EventFilter, ...conditions: EventFilter[]) => ({
  $and: [base, ...conditions],
});

const buildAccessibleEventFilter = async (userId: string): Promise<EventFilter> => {
  const userObjectId = toObjectId(userId);
  const [memberEventIds, blockedUserIds] = await Promise.all([
    EventMember.distinct("eventId", { userId: userObjectId }),
    getBlockedRelationshipUserIds(userId),
  ]);

  const conditions: EventFilter[] = [
    {
      $or: [{ hostId: userObjectId }, { visibility: "public" }, { _id: { $in: memberEventIds } }],
    },
  ];

  if (blockedUserIds.length > 0) {
    conditions.push({ hostId: { $nin: blockedUserIds.map(toObjectId) } });
  }

  return { $and: conditions };
};

const resolveInviteCandidates = async (hostId: string, input: CreateEventBody) => {
  const candidates = new Map<string, InviteCandidate>();

  for (const member of input.members) {
    mergeInviteCandidate(candidates, {
      userId: member.userId,
      role: member.role,
      canInviteGuests: Boolean(input.allowGuestInvites && member.canInviteGuests),
    });
  }

  const circleIds = uniqueObjectIdStrings(input.circles.map((circle) => circle.circleId));

  if (circleIds.length > 0) {
    const circleObjectIds = circleIds.map(toObjectId);
    const ownedCircles = await Circle.find({
      _id: { $in: circleObjectIds },
      ownerId: toObjectId(hostId),
    })
      .select("_id")
      .lean();

    if (ownedCircles.length !== circleIds.length) {
      throw new AppError("One or more circles were not found", 404, "CIRCLE_NOT_FOUND");
    }

    const circleInputById = new Map(input.circles.map((circle) => [circle.circleId, circle]));
    const circleMembers = await CircleMember.find({
      circleId: { $in: circleObjectIds },
      ownerId: toObjectId(hostId),
    })
      .select("circleId userId")
      .lean();

    for (const circleMember of circleMembers) {
      const circleInput = circleInputById.get(circleMember.circleId.toString());

      if (!circleInput) {
        continue;
      }

      mergeInviteCandidate(candidates, {
        userId: circleMember.userId.toString(),
        role: circleInput.role,
        canInviteGuests: Boolean(input.allowGuestInvites && circleInput.canInviteGuests),
      });
    }
  }

  candidates.delete(hostId);

  const candidateIds = Array.from(candidates.keys());
  const blockedInviteeIds = await getBlockedInviteeIds(hostId, candidateIds);

  return Array.from(candidates.values()).filter(
    (candidate) => !blockedInviteeIds.has(candidate.userId)
  );
};

export const createEvent = async (hostId: string, input: CreateEventBody) => {
  const invitees = await resolveInviteCandidates(hostId, input);
  const hostObjectId = toObjectId(hostId);
  const guestInviteLimit = input.allowGuestInvites ? input.guestInviteLimit : 0;

  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const [event] = await Event.create(
      [
        {
          hostId: hostObjectId,
          title: input.title,
          description: input.description ?? null,
          startAt: input.startAt,
          endAt: input.endAt,
          locationName: input.locationName,
          locationAddress: input.locationAddress ?? null,
          location: {
            type: "Point",
            coordinates: [input.location.coordinates[0], input.location.coordinates[1]],
          },
          visibility: input.visibility,
          allowGuestInvites: input.allowGuestInvites,
          guestInviteLimit,
          status: "active",
        },
      ],
      { session }
    );

    if (!event) {
      throw new AppError("Event could not be created", 500, "EVENT_CREATE_FAILED");
    }

    const memberDocs = [
      {
        eventId: event._id,
        userId: hostObjectId,
        invitedBy: null,
        role: "host" as const,
        rsvpStatus: "going" as const,
        canInviteGuests: true,
      },
      ...invitees.map((invitee) => ({
        eventId: event._id,
        userId: toObjectId(invitee.userId),
        invitedBy: hostObjectId,
        role: invitee.role,
        rsvpStatus: "invited" as const,
        canInviteGuests: invitee.canInviteGuests,
      })),
    ];

    const members = await EventMember.create(memberDocs, { session });

    return { event, members };
  });

  if (invitees.length > 0) {
    await notificationHooks.onEventInvitationsCreated({
      eventId: result.event._id.toString(),
      hostId,
      invitedUserIds: invitees.map((invitee) => invitee.userId),
    });
  }

  return result;
};

export const getEvents = async (userId: string, query: GetEventsQuery) => {
  const { page, limit, skip } = getPagination(query);
  const baseFilter = await buildAccessibleEventFilter(userId);
  const conditions: EventFilter[] = [];

  if (query.hostId) {
    conditions.push({ hostId: toObjectId(query.hostId) });
  }

  if (query.status) {
    conditions.push({ status: query.status });
  }

  if (query.visibility) {
    conditions.push({ visibility: query.visibility });
  }

  if (query.startAtFrom || query.startAtTo) {
    const startAt: Record<string, Date> = {};

    if (query.startAtFrom) {
      startAt.$gte = query.startAtFrom;
    }

    if (query.startAtTo) {
      startAt.$lte = query.startAtTo;
    }

    conditions.push({ startAt });
  }

  const filter = conditions.length > 0 ? withConditions(baseFilter, ...conditions) : baseFilter;
  const [events, total] = await Promise.all([
    Event.find(filter).sort({ startAt: 1 }).skip(skip).limit(limit).lean(),
    Event.countDocuments(filter),
  ]);

  return {
    data: events,
    pagination: toPagination(page, limit, total),
  };
};

export const getEventById = async (userId: string, eventId: string) => {
  const baseFilter = await buildAccessibleEventFilter(userId);
  const event = await Event.findOne(
    withConditions(baseFilter, { _id: toObjectId(eventId) })
  ).lean();

  if (!event) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  return event;
};

export const updateEvent = async (hostId: string, eventId: string, input: UpdateEventBody) => {
  const event = await Event.findOne({ _id: toObjectId(eventId), hostId: toObjectId(hostId) });

  if (!event) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  const nextStartAt = input.startAt ?? event.startAt;
  const nextEndAt = input.endAt ?? event.endAt;

  if (nextEndAt.getTime() <= nextStartAt.getTime()) {
    throw new AppError("endAt must be strictly after startAt", 400, "INVALID_EVENT_TIME_RANGE");
  }

  Object.assign(event, input);

  if (input.allowGuestInvites === false) {
    event.guestInviteLimit = 0;
  }

  await event.save();

  return event;
};

export const cancelEvent = async (hostId: string, eventId: string) => {
  const hostObjectId = toObjectId(hostId);
  const eventObjectId = toObjectId(eventId);

  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const event = await Event.findOne({ _id: eventObjectId, hostId: hostObjectId }).session(
      session ?? null
    );

    if (!event) {
      throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    }

    if (event.status === "cancelled") {
      throw new AppError("Event is already cancelled", 409, "EVENT_ALREADY_CANCELLED");
    }

    event.status = "cancelled";
    await event.save({ session });

    await EventMember.updateMany(
      { eventId: event._id },
      { $set: { rsvpStatus: "invited" } },
      { session }
    );

    return event;
  });

  await notificationHooks.onEventCancelled({ eventId, hostId });

  return result;
};

export const updateMyEventMembership = async (
  userId: string,
  eventId: string,
  input: UpdateMyEventMembershipBody
) => {
  const event = await Event.findOne({ _id: toObjectId(eventId), status: "active" })
    .select("_id")
    .lean();

  if (!event) {
    throw new AppError("Active event not found", 404, "EVENT_NOT_FOUND");
  }

  const membership = await EventMember.findOne({
    eventId: event._id,
    userId: toObjectId(userId),
  });

  if (!membership) {
    throw new AppError("Event membership not found", 404, "EVENT_MEMBERSHIP_NOT_FOUND");
  }

  if (input.rsvpStatus) {
    membership.rsvpStatus = input.rsvpStatus;
  }

  if ("memberWillArriveAt" in input) {
    membership.memberWillArriveAt = input.memberWillArriveAt ?? null;
  }

  await membership.save();

  return membership;
};

export const getActiveMapEvents = async (userId: string, query: ActiveMapEventsQuery) => {
  const baseFilter = await buildAccessibleEventFilter(userId);
  const filter = withConditions(baseFilter, {
    status: "active",
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [query.lng, query.lat],
        },
        $maxDistance: query.radiusKm * 1000,
      },
    },
  });

  return Event.find(filter).sort({ startAt: 1 }).limit(200).lean();
};

export const getUpcomingCalendarEvents = async (
  userId: string,
  query: UpcomingCalendarEventsQuery
) => {
  const { page, limit, skip } = getPagination(query);
  const baseFilter = await buildAccessibleEventFilter(userId);
  const filter = withConditions(baseFilter, {
    status: "active",
    startAt: { $gte: new Date() },
  });
  const [events, total] = await Promise.all([
    Event.find(filter).sort({ startAt: 1 }).skip(skip).limit(limit).lean(),
    Event.countDocuments(filter),
  ]);

  return {
    data: events,
    pagination: toPagination(page, limit, total),
  };
};

export const filterOutBlockedEventHosts = async <T extends { hostId: unknown }>(
  userId: string,
  events: T[]
) => {
  const blockedIds = new Set(await getBlockedRelationshipUserIds(userId));

  return events.filter((event) => !blockedIds.has(String(event.hostId)));
};

export const isUserBlockedFromEventHost = async (userId: string, hostId: string) => {
  const block = await Block.exists({
    $or: [
      { blockerId: toObjectId(userId), blockedId: toObjectId(hostId) },
      { blockerId: toObjectId(hostId), blockedId: toObjectId(userId) },
    ],
  });

  return Boolean(block);
};
