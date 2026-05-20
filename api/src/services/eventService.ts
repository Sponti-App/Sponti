import { type ClientSession } from "mongoose";
import {
  Block,
  Circle,
  CircleMember,
  Connection,
  Event,
  EventMember,
} from "#models/index";
import type {
  ActiveMapEventsQuery,
  CreateEventBody,
  GetEventsQuery,
  MyUpcomingEventsQuery,
  UpcomingCalendarEventsQuery,
  UpdateEventBody,
  UpdateMyEventMembershipBody,
} from "#schemas/eventSchemas";
import { getBlockedInviteeIds, getBlockedRelationshipUserIds } from "#services/blockService";
import { getUsersByIds, type UserSummary } from "#services/userDirectoryService";
import {
  createEventInvitationNotifications,
  createEventRsvpChangeNotification,
  createEventStatusNotifications,
} from "#services/notificationService";
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
type EventWithMemberStats<T> = T & {
  memberCount: number;
  goingCount: number;
};
type EventUserIdentity = {
  _id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
};
type EventWithPeople<T> = Omit<T, "hostId"> & {
  hostId: string | EventUserIdentity | null;
  attendees: EventUserIdentity[];
};
type EventWithHostProfile<T> = Omit<T, "hostId"> & {
  hostId: string | EventUserIdentity | null;
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

const attachMemberStats = async <T extends { _id: unknown }>(
  events: T[]
): Promise<Array<EventWithMemberStats<T>>> => {
  if (events.length === 0) {
    return [];
  }

  const eventIds = events.map((event) => toObjectId(String(event._id)));
  const members = await EventMember.find({ eventId: { $in: eventIds } })
    .select("eventId rsvpStatus")
    .lean();
  const statsByEventId = new Map<string, { memberCount: number; goingCount: number }>();

  for (const member of members) {
    const eventId = String(member.eventId);
    const stats = statsByEventId.get(eventId) ?? { memberCount: 0, goingCount: 0 };
    stats.memberCount += 1;

    if (member.rsvpStatus === "going") {
      stats.goingCount += 1;
    }

    statsByEventId.set(eventId, stats);
  }

  return events.map((event) => ({
    ...event,
    memberCount: statsByEventId.get(String(event._id))?.memberCount ?? 0,
    goingCount: statsByEventId.get(String(event._id))?.goingCount ?? 0,
  }));
};

const objectIdString = (value: unknown): string => {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }

  return String(value);
};

const extractHostId = (hostId: unknown): string | null => {
  if (!hostId) return null;
  return objectIdString(hostId);
};

const toEventUserIdentity = (userId: string, user?: UserSummary): EventUserIdentity => ({
  _id: user?._id ?? userId,
  displayName: user?.displayName ?? user?.username ?? "guest",
  username: user?.username,
  avatarUrl: user?.avatarUrl ?? null,
});

const attachHostProfiles = async <T extends { hostId: unknown }>(
  events: T[]
): Promise<Array<EventWithHostProfile<T>>> => {
  if (events.length === 0) {
    return [];
  }

  const hostIds = events
    .map((event) => extractHostId(event.hostId))
    .filter((id): id is string => id !== null);
  const users = await getUsersByIds(uniqueObjectIdStrings(hostIds));

  return events.map((event) => {
    const hostId = extractHostId(event.hostId);
    if (!hostId) return { ...event, hostId: null };

    const user = users.get(hostId);
    return {
      ...event,
      hostId: user ? toEventUserIdentity(hostId, user) : hostId,
    };
  });
};

const attachEventPeople = async <T extends { _id: unknown; hostId: unknown }>(
  events: T[]
): Promise<Array<EventWithPeople<T>>> => {
  if (events.length === 0) {
    return [];
  }

  const eventIds = events.map((event) => toObjectId(String(event._id)));
  const goingMembers = await EventMember.find({
    eventId: { $in: eventIds },
    rsvpStatus: "going",
  })
    .select("eventId userId")
    .lean();

  const userIds = uniqueObjectIdStrings([
    ...events
      .map((event) => extractHostId(event.hostId))
      .filter((id): id is string => id !== null),
    ...goingMembers.map((member) => String(member.userId)),
  ]);
  const users = await getUsersByIds(userIds);
  const hostIdByEventId = new Map(
    events.map((event) => [String(event._id), extractHostId(event.hostId)])
  );
  const attendeesByEventId = new Map<string, EventUserIdentity[]>();

  for (const member of goingMembers) {
    const eventId = String(member.eventId);
    const userId = String(member.userId);
    if (userId === hostIdByEventId.get(eventId)) continue;
    const attendees = attendeesByEventId.get(eventId) ?? [];
    attendees.push(toEventUserIdentity(userId, users.get(userId)));
    attendeesByEventId.set(eventId, attendees);
  }

  return events.map((event) => {
    const hostId = extractHostId(event.hostId);
    if (!hostId) {
      return {
        ...event,
        hostId: null,
        attendees: attendeesByEventId.get(String(event._id)) ?? [],
      };
    }

    return {
      ...event,
      hostId: toEventUserIdentity(hostId, users.get(hostId)),
      attendees: attendeesByEventId.get(String(event._id)) ?? [],
    };
  });
};

const assertAcceptedConnectionInvitees = async (hostId: string, inviteeIds: string[]) => {
  const uniqueInviteeIds = uniqueObjectIdStrings(inviteeIds);

  if (uniqueInviteeIds.length === 0) {
    return;
  }

  const hostObjectId = toObjectId(hostId);
  const inviteeObjectIds = uniqueInviteeIds.map(toObjectId);
  const connections = await Connection.find({
    status: "accepted",
    $or: [
      { requesterId: hostObjectId, receiverId: { $in: inviteeObjectIds } },
      { receiverId: hostObjectId, requesterId: { $in: inviteeObjectIds } },
    ],
  })
    .select("requesterId receiverId")
    .lean();
  const acceptedUserIds = new Set<string>();

  for (const connection of connections) {
    const requesterId = connection.requesterId.toString();
    const receiverId = connection.receiverId.toString();
    acceptedUserIds.add(requesterId === hostId ? receiverId : requesterId);
  }

  const missingInvitee = uniqueInviteeIds.find((inviteeId) => !acceptedUserIds.has(inviteeId));

  if (missingInvitee) {
    throw new AppError(
      "Only accepted connections can be invited to private events",
      403,
      "EVENT_INVITEE_NOT_ACCEPTED_CONNECTION"
    );
  }
};

const resolveInviteCandidates = async (hostId: string, input: CreateEventBody) => {
  const candidates = new Map<string, InviteCandidate>();

  for (const member of input.members) {
    mergeInviteCandidate(candidates, {
      userId: member.userId,
      role: member.role,
      canInviteGuests: input.allowGuestInvites !== "none",
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
        canInviteGuests: input.allowGuestInvites !== "none",
      });
    }
  }

  candidates.delete(hostId);

  const candidateIds = Array.from(candidates.keys());
  const blockedInviteeIds = await getBlockedInviteeIds(hostId, candidateIds);
  const visibleCandidates = Array.from(candidates.values()).filter(
    (candidate) => !blockedInviteeIds.has(candidate.userId)
  );

  await assertAcceptedConnectionInvitees(
    hostId,
    visibleCandidates.map((candidate) => candidate.userId)
  );

  return visibleCandidates;
};

export const createEvent = async (hostId: string, input: CreateEventBody) => {
  const invitees =
    input.visibility === "public" ? [] : await resolveInviteCandidates(hostId, input);
  const hostObjectId = toObjectId(hostId);

  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const [event] = await Event.create(
      [
        {
          hostId: hostObjectId,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
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
          guestInviteLimit: input.guestInviteLimit,
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

    if (invitees.length > 0) {
      await createEventInvitationNotifications({
        eventId: String(event._id),
        hostId,
        eventTitle: event.title,
        inviteeIds: invitees.map((invitee) => invitee.userId),
        session,
      });
    }

    return { event, members };
  });

  return result;
};

export const getEvents = async (userId: string, query: GetEventsQuery) => {
  const { page, limit, skip } = getPagination(query);
  const baseFilter = await buildAccessibleEventFilter(userId);
  const conditions: EventFilter[] = [];

  // TODO(api-cleanup): `/events/mine/upcoming` is now the frontend dashboard
  // source of truth because it returns the split hosted/invited/past buckets.
  // Keep `hostedByMe=true` here only as a generic-list compatibility path for
  // older clients, scripts, or manual API checks. Once no caller uses it,
  // remove `hostedByMe` from the query schema and this server-side branch so
  // hosted filtering lives in exactly one endpoint.
  if (query.hostedByMe) {
    conditions.push({ hostId: toObjectId(userId) });
  } else if (query.hostId) {
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

  if (query.endAtFrom || query.endAtTo) {
    const endAt: Record<string, Date> = {};

    if (query.endAtFrom) {
      endAt.$gt = query.endAtFrom;
    }

    if (query.endAtTo) {
      endAt.$lte = query.endAtTo;
    }

    conditions.push({ endAt });
  }

  const filter = conditions.length > 0 ? withConditions(baseFilter, ...conditions) : baseFilter;
  const [events, total] = await Promise.all([
    Event.find(filter).sort({ startAt: 1 }).skip(skip).limit(limit).lean(),
    Event.countDocuments(filter),
  ]);

  return {
    data: await attachHostProfiles(events),
    pagination: toPagination(page, limit, total),
  };
};

/**
 * Returns a single event visible to the authenticated user, enriched with the
 * caller's RSVP and member counts for frontend detail/edit surfaces.
 */
export const getEventById = async (userId: string, eventId: string) => {
  const baseFilter = await buildAccessibleEventFilter(userId);
  const event = await Event.findOne(
    withConditions(baseFilter, { _id: toObjectId(eventId) })
  ).lean();

  if (!event) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  const withStats = await attachMemberStats([event]);
  const withRsvp = await attachMyRsvp(userId, withStats);
  const withPeople = await attachEventPeople(withRsvp);
  const enriched = withPeople[0];

  if (!enriched) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  return enriched;
};

/**
 * Returns the "your flares" dashboard data: upcoming hosted events, upcoming
 * invited events, and hosted events that ended within the last two weeks.
 */
export const getMyUpcomingEvents = async (userId: string, query: MyUpcomingEventsQuery) => {
  const userObjectId = toObjectId(userId);
  const now = query.endAtFrom ?? new Date();
  const pastFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [memberEventIds, blockedUserIds] = await Promise.all([
    EventMember.distinct("eventId", { userId: userObjectId }),
    getBlockedRelationshipUserIds(userId),
  ]);
  const blockedObjectIds = blockedUserIds.map(toObjectId);

  const [hostedByMe, invited, pastHosted] = await Promise.all([
    Event.find({
      hostId: userObjectId,
      status: { $in: ["active", "cancelled"] },
      endAt: { $gt: now },
    })
      .sort({ startAt: 1 })
      .lean(),
    Event.find({
      _id: { $in: memberEventIds },
      hostId: { $ne: userObjectId, $nin: blockedObjectIds },
      status: "active",
      endAt: { $gt: now },
    })
      .sort({ startAt: 1 })
      .lean(),
    Event.find({
      hostId: userObjectId,
      endAt: { $lte: now, $gte: pastFrom },
    })
      .sort({ startAt: -1 })
      .lean(),
  ]);

  const [hostedByMeWithHost, invitedWithHost, pastHostedWithHost] = await Promise.all([
    attachHostProfiles(hostedByMe),
    attachHostProfiles(invited),
    attachHostProfiles(pastHosted),
  ]);

  const [hostedWithStats, invitedWithStats, pastWithStats] = await Promise.all([
    attachMemberStats(hostedByMeWithHost),
    attachMemberStats(invitedWithHost),
    attachMemberStats(pastHostedWithHost),
  ]);

  const [hostedWithRsvp, invitedWithRsvp, pastWithRsvp] = await Promise.all([
    attachMyRsvp(userId, hostedWithStats),
    attachMyRsvp(userId, invitedWithStats),
    attachMyRsvp(userId, pastWithStats),
  ]);
  const [hostedWithPeople, invitedWithPeople, pastWithPeople] = await Promise.all([
    attachEventPeople(hostedWithRsvp),
    attachEventPeople(invitedWithRsvp),
    attachEventPeople(pastWithRsvp),
  ]);

  return {
    hostedByMe: hostedWithPeople,
    invited: invitedWithPeople,
    pastHosted: pastWithPeople,
  };
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

  await event.save();

  return event;
};

/**
 * Cancels an event if the authenticated user is the host, keeps member RSVP
 * values unchanged, and notifies invited members exactly once.
 */
export const cancelEvent = async (hostId: string, eventId: string) => {
  const eventObjectId = toObjectId(eventId);

  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const event = await Event.findOne({ _id: eventObjectId }).session(session ?? null);

    if (!event) {
      throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    }

    if (String(event.hostId) !== hostId) {
      throw new AppError(
        "Only the event host can cancel this event",
        403,
        "EVENT_CANCEL_FORBIDDEN"
      );
    }

    if (event.status === "cancelled") {
      return { event, changed: false };
    }

    event.status = "cancelled";
    await event.save({ session });

    await createEventStatusNotifications({
      eventId: String(event._id),
      hostId,
      eventTitle: event.title,
      type: "event_cancelled",
      session,
    });

    return { event, changed: true };
  });

  return result.event;
};

export const reactivateEvent = async (hostId: string, eventId: string) => {
  const eventObjectId = toObjectId(eventId);

  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const event = await Event.findOne({ _id: eventObjectId }).session(session ?? null);

    if (!event) {
      throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    }

    if (String(event.hostId) !== hostId) {
      throw new AppError(
        "Only the event host can reactivate this event",
        403,
        "EVENT_REACTIVATE_FORBIDDEN"
      );
    }

    if (event.status === "active") {
      return { event, changed: false };
    }

    if (event.status !== "cancelled") {
      throw new AppError("Event cannot be reactivated", 409, "EVENT_NOT_REACTIVATABLE");
    }

    if (event.endAt.getTime() <= Date.now()) {
      throw new AppError("Past events cannot be reactivated", 409, "EVENT_NOT_REACTIVATABLE");
    }

    event.status = "active";
    await event.save({ session });

    await createEventStatusNotifications({
      eventId: String(event._id),
      hostId,
      eventTitle: event.title,
      type: "event_reactivated",
      session,
    });

    return { event, changed: true };
  });

  return result.event;
};

export const updateMyEventMembership = async (
  userId: string,
  eventId: string,
  input: UpdateMyEventMembershipBody
) => {
  const event = await Event.findOne({ _id: toObjectId(eventId), status: "active" })
    .select("_id hostId title")
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

  const previousRsvpStatus = membership.rsvpStatus;
  const nextRsvpStatus = input.rsvpStatus;
  const rsvpStatusChanged = nextRsvpStatus !== undefined && nextRsvpStatus !== previousRsvpStatus;

  if (input.rsvpStatus) {
    membership.rsvpStatus = input.rsvpStatus;
  }

  if ("memberWillArriveAt" in input) {
    membership.memberWillArriveAt = input.memberWillArriveAt ?? null;
  }

  await membership.save();

  if (rsvpStatusChanged && nextRsvpStatus) {
    await createEventRsvpChangeNotification({
      eventId: String(event._id),
      hostId: String(event.hostId),
      attendeeId: userId,
      eventTitle: event.title,
      rsvpStatus: nextRsvpStatus,
    });
  }

  return membership;
};

// Attach the caller's rsvpStatus to a list of event documents. The SPA's
// adaptApiEvent reads `myRsvp` and surfaces it as `event.myRsvp`, which the
// home screen uses to render the "going" badge without depending on local
// optimistic state alone.
const attachMyRsvp = async <T extends { _id: unknown }>(
  userId: string,
  events: T[]
): Promise<Array<T & { myRsvp: string | null }>> => {
  if (events.length === 0) {
    return [];
  }

  // Cast to ObjectId[] — every Event document _id is one, but the generic
  // signature can't prove it. Keeping the helper generic so it works against
  // both the map and calendar endpoints' lean results.
  const eventIds = events.map((event) => toObjectId(String(event._id)));
  const memberships = await EventMember.find({
    eventId: { $in: eventIds },
    userId: toObjectId(userId),
  })
    .select("eventId rsvpStatus")
    .lean();

  const rsvpByEventId = new Map<string, string>();

  for (const m of memberships) {
    rsvpByEventId.set(String(m.eventId), m.rsvpStatus);
  }

  return events.map((event) => ({
    ...event,
    myRsvp: rsvpByEventId.get(String(event._id)) ?? null,
  }));
};

/**
 * Returns events that should appear on the home map for the authenticated user.
 *
 * The base filter enforces event visibility and block rules, then the map
 * filter narrows results to active events within the requested radius. Events
 * whose end time is now or in the past are excluded at the database layer so
 * clients do not need to decide whether an ended event is still displayable.
 *
 * MongoDB expects GeoJSON coordinates in [lng, lat] order and distances in
 * meters, while the public query uses latitude/longitude and radius in km.
 */
export const getActiveMapEvents = async (userId: string, query: ActiveMapEventsQuery) => {
  const baseFilter = await buildAccessibleEventFilter(userId);
  const filter = withConditions(baseFilter, {
    status: "active",
    endAt: { $gt: new Date() },
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

  const events = await Event.find(filter).sort({ startAt: 1 }).limit(200).lean();
  return attachMyRsvp(userId, await attachHostProfiles(events));
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
    data: await attachMyRsvp(userId, await attachHostProfiles(events)),
    pagination: toPagination(page, limit, total),
  };
};

export const filterOutBlockedEventHosts = async <T extends { hostId: unknown }>(
  userId: string,
  events: T[]
) => {
  const blockedIds = new Set(await getBlockedRelationshipUserIds(userId));

  return events.filter((event) => {
    const hostId = extractHostId(event.hostId);
    return !hostId || !blockedIds.has(hostId);
  });
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
