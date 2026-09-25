import { type ClientSession } from "mongoose";
import { Block, Circle, CircleMember, Connection, Event, EventMember } from "#models/index";
import type {
  ActiveMapEventsQuery,
  CreateEventBody,
  GetEventsQuery,
  InviteEventMembersBody,
  MyUpcomingEventsQuery,
  UpcomingCalendarEventsQuery,
  UpdateEventBody,
  UpdateMyEventMembershipBody,
} from "#schemas/eventSchemas";
import { getBlockedInviteeIds, getBlockedRelationshipUserIds } from "#services/blockService";
import { getAcceptedConnectionUserIds } from "#services/connectionService";
import { getUsersByIds, type UserSummary } from "#services/userDirectoryService";
import {
  createEventGuestRemovedNotification,
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
type InviteSelection = Pick<CreateEventBody, "members" | "circles" | "allowGuestInvites">;
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

const isDuplicateKeyError = (error: unknown): error is { code: number } =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

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
  const [memberEventIds, removedEventIds, blockedUserIds] = await Promise.all([
    EventMember.distinct("eventId", { userId: userObjectId, removedAt: null }),
    EventMember.distinct("eventId", { userId: userObjectId, removedAt: { $ne: null } }),
    getBlockedRelationshipUserIds(userId),
  ]);

  const conditions: EventFilter[] = [
    {
      $or: [{ hostId: userObjectId }, { visibility: "public" }, { _id: { $in: memberEventIds } }],
    },
  ];

  // A guest the host removed can't see the flare again, even a public one.
  if (removedEventIds.length > 0) {
    conditions.push({ _id: { $nin: removedEventIds } });
  }

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
  const members = await EventMember.find({ eventId: { $in: eventIds }, removedAt: null })
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
    removedAt: null,
  })
    .select("eventId userId")
    .lean();

  const userIds = uniqueObjectIdStrings([
    ...events.map((event) => extractHostId(event.hostId)).filter((id): id is string => id !== null),
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

const resolveInviteCandidates = async (hostId: string, input: InviteSelection) => {
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
      .select("_id type")
      .lean();

    if (ownedCircles.length !== circleIds.length) {
      throw new AppError("One or more circles were not found", 404, "CIRCLE_NOT_FOUND");
    }

    const circleInputById = new Map(input.circles.map((circle) => [circle.circleId, circle]));

    // "all friends" isn't a membership list the api keeps in sync — it's
    // every accepted, unblocked connection of the host, resolved live here
    // (#154). Any CircleMember rows still stored against the "all" circle
    // (from before this fix, or a stale manual add) are intentionally left
    // out of the expansion below rather than unioned in, so a host can never
    // re-invite someone they've since unfriended or blocked just because an
    // old row lingers.
    const allCircleIds = ownedCircles
      .filter((circle) => circle.type === "all")
      .map((circle) => circle._id.toString());
    const nonAllCircleObjectIds = ownedCircles
      .filter((circle) => circle.type !== "all")
      .map((circle) => circle._id);

    if (allCircleIds.length > 0) {
      const connectionUserIds = await getAcceptedConnectionUserIds(hostId);

      for (const allCircleId of allCircleIds) {
        const circleInput = circleInputById.get(allCircleId);

        if (!circleInput) {
          continue;
        }

        for (const userId of connectionUserIds) {
          mergeInviteCandidate(candidates, {
            userId,
            role: circleInput.role,
            canInviteGuests: input.allowGuestInvites !== "none",
          });
        }
      }
    }

    if (nonAllCircleObjectIds.length > 0) {
      const circleMembers = await CircleMember.find({
        circleId: { $in: nonAllCircleObjectIds },
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
          // Public flares don't expand circles, so there's nothing to record.
          invitedCircleIds:
            input.visibility === "public"
              ? []
              : uniqueObjectIdStrings(input.circles.map((circle) => circle.circleId)).map(
                  toObjectId
                ),
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

    const members = await EventMember.create(memberDocs, { session, ordered: true });

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
    EventMember.distinct("eventId", { userId: userObjectId, removedAt: null }),
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

  const wasPublic = event.visibility === "public";
  // #181: the hard cap, and the goingReservationCount counter behind it, only
  // apply to public flares — a private flare's going members never touch it.
  // Flipping visibility either direction can make it stale relative to
  // EventMember (a private flare's roster can change freely while the
  // counter isn't being kept in sync), so any actual flip resets the sync
  // flag. The next reservation attempt — which can only happen once the
  // flare is public again — recomputes it from EventMember's live truth
  // instead of trusting whatever it held from before.
  const visibilityChanging = input.visibility !== undefined && input.visibility !== event.visibility;

  Object.assign(event, input);

  if (!(wasPublic && event.visibility === "private")) {
    await event.save();

    if (visibilityChanging) {
      await Event.updateOne({ _id: event._id }, { $set: { goingReservationSyncedAt: null } });
    }

    return event;
  }

  // Going public -> private: anyone who joined from the map and is going keeps
  // their spot, but joiners who aren't going (and were never invited) are
  // dropped so the flare stops showing for them. Invited guests, removed guests
  // and the host are untouched.
  await withTransactionFallback(async (session?: ClientSession) => {
    await event.save({ session });
    await Event.updateOne(
      { _id: event._id },
      { $set: { goingReservationSyncedAt: null } },
      { session }
    );
    await EventMember.deleteMany(
      {
        eventId: event._id,
        role: { $ne: "host" },
        invitedBy: null,
        rsvpStatus: { $ne: "going" },
        removedAt: null,
      },
      { session }
    );
  });

  return event;
};

/**
 * Returns a flare's guest list for its host: every member except the host,
 * with their RSVP, in the order they were invited. Anyone else gets 404 so the
 * list isn't disclosed.
 */
export const getEventMembers = async (hostId: string, eventId: string) => {
  const event = await Event.findOne({ _id: toObjectId(eventId), hostId: toObjectId(hostId) })
    .select("_id")
    .lean();

  if (!event) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  const members = await EventMember.find({
    eventId: event._id,
    role: { $ne: "host" },
    removedAt: null,
  })
    .select("userId role rsvpStatus invitedBy")
    .sort({ createdAt: 1 })
    .lean();
  const userIds = members.map((member) => String(member.userId));
  const users = await getUsersByIds(uniqueObjectIdStrings(userIds));

  return members.map((member) => {
    const userId = String(member.userId);

    return {
      user: toEventUserIdentity(userId, users.get(userId)),
      role: member.role,
      rsvpStatus: member.rsvpStatus,
      // Joined a public flare on their own rather than being invited.
      joinedWithoutInvite: member.invitedBy == null,
    };
  });
};

/**
 * Invites more friends and circles to a posted flare. Circles are expanded to
 * their current members, the same snapshot rule as creation. People already on
 * the flare keep their RSVP untouched, and only newly added invitees are
 * notified. Upserting keeps a repeated request from creating duplicates.
 * Someone the host removed earlier is restored as a fresh invitee and notified
 * again, which is also how a removal is undone.
 */
export const inviteEventMembers = async (
  hostId: string,
  eventId: string,
  input: InviteEventMembersBody
) => {
  const event = await Event.findOne({ _id: toObjectId(eventId), hostId: toObjectId(hostId) })
    .select("_id title status endAt allowGuestInvites")
    .lean();

  if (!event) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  if (event.status !== "active" || event.endAt.getTime() <= Date.now()) {
    throw new AppError(
      "Only active events that haven't ended can take new invitees",
      409,
      "EVENT_NOT_INVITABLE"
    );
  }

  const candidates = await resolveInviteCandidates(hostId, {
    ...input,
    allowGuestInvites: event.allowGuestInvites,
  });

  const hostObjectId = toObjectId(hostId);
  const circleObjectIds = uniqueObjectIdStrings(input.circles.map((circle) => circle.circleId)).map(
    toObjectId
  );

  // Remember which circles the flare went to, even if they were empty or
  // everyone in them is already on it: someone added to the circle later can
  // then be offered the flare.
  const recordCircles = async (session?: ClientSession) => {
    if (circleObjectIds.length === 0) return;
    await Event.updateOne(
      { _id: event._id },
      { $addToSet: { invitedCircleIds: { $each: circleObjectIds } } },
      { session }
    );
  };

  if (candidates.length === 0) {
    await recordCircles();
    return { invitedUserIds: [] };
  }

  return withTransactionFallback(async (session?: ClientSession) => {
    await recordCircles(session);

    const removed = (await EventMember.find({
      eventId: event._id,
      userId: { $in: candidates.map((candidate) => toObjectId(candidate.userId)) },
      removedAt: { $ne: null },
    })
      .select("userId")
      .session(session ?? null)
      .lean()) as Array<{ userId: unknown }>;
    const restoredUserIds = removed.map((member) => String(member.userId));

    if (restoredUserIds.length > 0) {
      await EventMember.updateMany(
        {
          eventId: event._id,
          userId: { $in: restoredUserIds.map(toObjectId) },
          removedAt: { $ne: null },
        },
        {
          $set: {
            removedAt: null,
            rsvpStatus: "invited",
            memberWillArriveAt: null,
            invitedBy: hostObjectId,
          },
        },
        { session }
      );
    }

    const result = await EventMember.bulkWrite(
      candidates.map((candidate) => ({
        updateOne: {
          filter: { eventId: event._id, userId: toObjectId(candidate.userId) },
          update: {
            $setOnInsert: {
              invitedBy: hostObjectId,
              role: candidate.role,
              rsvpStatus: "invited",
              canInviteGuests: candidate.canInviteGuests,
            },
          },
          upsert: true,
        },
      })),
      { session, ordered: true }
    );
    const newUserIds = Object.keys(result.upsertedIds)
      .map((index) => candidates[Number(index)]?.userId)
      .filter((userId): userId is string => userId !== undefined);
    const invitedUserIds = [...newUserIds, ...restoredUserIds];

    if (newUserIds.length > 0) {
      await createEventInvitationNotifications({
        eventId: String(event._id),
        hostId,
        eventTitle: event.title,
        inviteeIds: newUserIds,
        session,
      });
    }

    if (restoredUserIds.length > 0) {
      await createEventInvitationNotifications({
        eventId: String(event._id),
        hostId,
        eventTitle: event.title,
        inviteeIds: restoredUserIds,
        session,
        repeat: true,
      });
    }

    return { invitedUserIds };
  });
};

/**
 * The host's flares that were sent to a circle and are still worth inviting
 * someone to: active and not ended, soonest first. Pass `userId` to leave out
 * flares that person is already on (or was removed from). Backs the "add them
 * to your flares too?" prompt when a circle grows.
 */
export const getCircleUpcomingEvents = async (
  hostId: string,
  circleId: string,
  query: { userId?: string } = {}
) => {
  const hostObjectId = toObjectId(hostId);
  const circleObjectId = toObjectId(circleId);

  const circle = await Circle.exists({ _id: circleObjectId, ownerId: hostObjectId });

  if (!circle) {
    throw new AppError("Circle not found", 404, "CIRCLE_NOT_FOUND");
  }

  const conditions: EventFilter = {
    hostId: hostObjectId,
    invitedCircleIds: circleObjectId,
    status: "active",
    endAt: { $gt: new Date() },
  };

  if (query.userId) {
    const alreadyOn = await EventMember.distinct("eventId", { userId: toObjectId(query.userId) });

    if (alreadyOn.length > 0) {
      conditions._id = { $nin: alreadyOn };
    }
  }

  return Event.find(conditions)
    .select("_id title startAt endAt")
    .sort({ startAt: 1 })
    .limit(50)
    .lean();
};

/**
 * Takes a guest off a flare's guest list. The member row is kept with
 * `removedAt` set, so the person can't see or rejoin the flare (even a public
 * one) until the host invites them again. A guest who had said "going" gets one
 * neutral notice; invited and declined guests aren't told. Only allowed for the
 * host, and only while the flare is active and hasn't started.
 */
export const removeEventMember = async (hostId: string, eventId: string, guestId: string) => {
  if (guestId === hostId) {
    throw new AppError("The host can't be removed from their own event", 400, "CANNOT_REMOVE_HOST");
  }

  const event = await Event.findOne({ _id: toObjectId(eventId), hostId: toObjectId(hostId) })
    .select("_id title status startAt visibility")
    .lean();

  if (!event) {
    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  if (event.status !== "active" || event.startAt.getTime() <= Date.now()) {
    throw new AppError(
      "Guests can only be removed from active events that haven't started",
      409,
      "EVENT_GUEST_LIST_LOCKED"
    );
  }

  return withTransactionFallback(async (session?: ClientSession) => {
    const member = await EventMember.findOneAndUpdate(
      {
        eventId: event._id,
        userId: toObjectId(guestId),
        role: { $ne: "host" },
        removedAt: null,
      },
      { $set: { removedAt: new Date() } },
      { session, returnDocument: "before" }
    );

    if (!member) {
      throw new AppError("Guest not found on this event", 404, "EVENT_MEMBER_NOT_FOUND");
    }

    const wasGoing = member.rsvpStatus === "going";

    if (wasGoing) {
      // #181: removal frees their spot back up, same as a going -> declined
      // answer would — but only for public flares, which is all the cap ever
      // applies to.
      if (event.visibility === "public") {
        await releaseGoingSpot(event._id, session);
      }
      await createEventGuestRemovedNotification({
        eventId: String(event._id),
        guestId,
        eventTitle: event.title,
        session,
      });
    }

    return { removedUserId: guestId, notified: wasGoing };
  });
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

/**
 * `reserveGoingSpot`/`releaseGoingSpot` below are only ever called for
 * public flares (see the `isPublicFlare` gate in `updateMyEventMembership`
 * and the `event.visibility === "public"` check in `removeEventMember`) —
 * per the decision update on #181, the hard cap applies to public flares
 * only, so a private flare's `goingReservationCount` is simply never
 * touched. That also means it can go stale relative to EventMember while a
 * flare is private (its roster changes freely with nothing keeping the
 * counter in sync) and needs resyncing once/if the flare goes public again —
 * `updateEvent` resets `goingReservationSyncedAt` to null on every actual
 * visibility flip (either direction) so this reconciliation always re-runs
 * rather than trusting a value left over from a previous public period.
 *
 * The guest limit was never enforced before #181 either, so this may still
 * be sitting at its schema default (0) on a flare that already has real
 * `going` members the first time it's ever used. Either way, this reconciles
 * it once, from a live count of EventMember, the first time a reservation is
 * attempted for that flare — self-healing instead of a data migration. The
 * conditional filter (`goingReservationSyncedAt: null`) makes two concurrent
 * callers race safely: only one of their `updateOne` calls can match and
 * apply for a given flare, so the count is computed and stored exactly once.
 *
 * This runs inside `updateMyEventMembership`'s `withTransactionFallback`
 * call, so on a replica set it only durably commits alongside a reservation
 * that actually succeeds — a rejected (`EVENT_FULL`) attempt rolls the sync
 * back too. That's fine: the next attempt for that flare just recomputes the
 * same real count again, so the gate is always correct even when the write
 * hasn't "stuck" yet.
 */
const reconcileGoingReservation = async (
  eventId: ReturnType<typeof toObjectId>,
  session?: ClientSession
): Promise<void> => {
  const alreadySynced = await Event.exists({
    _id: eventId,
    goingReservationSyncedAt: { $ne: null },
  }).session(session ?? null);

  if (alreadySynced) {
    return;
  }

  // The host is never counted against the limit (they can always host their
  // own flare), and `reserveGoingSpot`/`releaseGoingSpot` never run for the
  // host's own row, so the backfilled count must exclude it too or it would
  // permanently overcount by one relative to the incremental counter.
  const realGoingCount = await EventMember.countDocuments({
    eventId,
    role: { $ne: "host" },
    rsvpStatus: "going",
    removedAt: null,
  }).session(session ?? null);

  await Event.updateOne(
    { _id: eventId, goingReservationSyncedAt: null },
    { $set: { goingReservationCount: realGoingCount, goingReservationSyncedAt: new Date() } },
    { session }
  );
};

/**
 * Atomically reserves one "going" spot on a flare (#181). The gate is a
 * single conditional document update — `$inc` only applies if the limit
 * isn't enforced for this flare, or `goingReservationCount` is still under
 * `guestInviteLimit` — which is what makes two concurrent joins for the last
 * spot resolve to exactly one winner. That guarantee holds with or without a
 * replica set, unlike `withTransactionFallback`'s no-session fallback (see
 * its comment): a multi-document transaction is unavailable on a standalone
 * Mongo, but a single-document update is always atomic regardless. Always
 * keeps the counter in sync, even when the limit isn't enforced right now,
 * so a later mode change starts from an accurate count instead of a stale one.
 */
const reserveGoingSpot = async (
  eventId: ReturnType<typeof toObjectId>,
  session?: ClientSession
): Promise<void> => {
  await reconcileGoingReservation(eventId, session);

  const reserved = await Event.findOneAndUpdate(
    {
      _id: eventId,
      $or: [
        { guestInviteLimit: { $lte: 0 } },
        { allowGuestInvites: { $ne: "none" } },
        { $expr: { $lt: ["$goingReservationCount", "$guestInviteLimit"] } },
      ],
    },
    { $inc: { goingReservationCount: 1 } },
    { session }
  );

  if (!reserved) {
    throw new AppError("This flare is full", 409, "EVENT_FULL");
  }
};

/**
 * Releases a previously reserved "going" spot: a going -> declined answer, a
 * host removing a going guest (#148), or a compensating rollback after a
 * reservation's membership write failed. Floored at 0 by the query guard,
 * and safe to call on a flare that was never reconciled — the next
 * `reserveGoingSpot` call reconciles from EventMember's live truth
 * regardless of what this no-ops to in between.
 */
const releaseGoingSpot = async (
  eventId: ReturnType<typeof toObjectId>,
  session?: ClientSession
): Promise<void> => {
  await Event.updateOne(
    { _id: eventId, goingReservationCount: { $gt: 0 } },
    { $inc: { goingReservationCount: -1 } },
    { session }
  );
};

export const updateMyEventMembership = async (
  userId: string,
  eventId: string,
  input: UpdateMyEventMembershipBody
) => {
  const eventObjectId = toObjectId(eventId);
  const event = await Event.findOne({ _id: eventObjectId, status: "active" })
    .select("_id hostId title visibility allowGuestInvites guestInviteLimit")
    .lean();

  if (!event) {
    throw new AppError("Active event not found", 404, "EVENT_NOT_FOUND");
  }

  return withTransactionFallback(async (session?: ClientSession) => {
    let membership = await EventMember.findOne({
      eventId: event._id,
      userId: toObjectId(userId),
    }).session(session ?? null);

    // A guest the host removed can't answer, and can't rejoin a public flare.
    if (membership?.removedAt) {
      throw new AppError("Event membership not found", 404, "EVENT_MEMBERSHIP_NOT_FOUND");
    }

    // Someone who isn't on the guest list can only join a public flare, by
    // answering going or declined, unless they're blocked from the host.
    let joinedPublicFlare = false;

    if (!membership) {
      if (
        event.visibility !== "public" ||
        input.rsvpStatus === undefined ||
        (await isUserBlockedFromEventHost(userId, String(event.hostId)))
      ) {
        throw new AppError("Event membership not found", 404, "EVENT_MEMBERSHIP_NOT_FOUND");
      }

      membership = new EventMember({
        eventId: event._id,
        userId: toObjectId(userId),
        invitedBy: null,
        role: "guest",
        rsvpStatus: "invited",
        canInviteGuests: false,
      });
      joinedPublicFlare = true;
    }

    const previousRsvpStatus = membership.rsvpStatus;
    const nextRsvpStatus = input.rsvpStatus;
    // A stranger declining a public flare isn't news to the host; only a join is.
    const rsvpStatusChanged =
      nextRsvpStatus !== undefined &&
      nextRsvpStatus !== previousRsvpStatus &&
      !(joinedPublicFlare && nextRsvpStatus === "declined");

    // #181 (decision update): the hard cap — and the counter behind it — only
    // ever apply to public flares. A private flare's limit is whoever the
    // host invited; there's no cap to reserve or release, so the private
    // path never touches `goingReservationCount` at all.
    const isPublicFlare = event.visibility === "public";

    // Only entering `going` for the first time consumes a spot — an
    // ETA-only update, or resubmitting `going` while already going, must not.
    const enteringGoing =
      isPublicFlare && previousRsvpStatus !== "going" && nextRsvpStatus === "going";
    const leavingGoing =
      isPublicFlare &&
      previousRsvpStatus === "going" &&
      nextRsvpStatus !== undefined &&
      nextRsvpStatus !== "going";

    let reservedSpot = false;

    if (enteringGoing) {
      // Throws EVENT_FULL before any membership write if the flare is at cap.
      await reserveGoingSpot(event._id, session);
      reservedSpot = true;
    }

    if (input.rsvpStatus) {
      membership.rsvpStatus = input.rsvpStatus;
    }

    if ("memberWillArriveAt" in input) {
      membership.memberWillArriveAt = input.memberWillArriveAt ?? null;
    }

    try {
      await membership.save({ session });
    } catch (error) {
      if (!joinedPublicFlare || !isDuplicateKeyError(error)) {
        if (reservedSpot) {
          await releaseGoingSpot(event._id, session);
        }
        throw error;
      }

      // Two join requests raced (a double tap or a retry) and the other created
      // the row first. Apply this answer to that row instead of failing.
      const existing = await EventMember.findOne({
        eventId: event._id,
        userId: toObjectId(userId),
        removedAt: null,
      }).session(session ?? null);

      if (!existing) {
        if (reservedSpot) {
          await releaseGoingSpot(event._id, session);
        }
        throw error;
      }

      const existingWasAlreadyGoing = existing.rsvpStatus === "going";
      existing.rsvpStatus = membership.rsvpStatus;
      if ("memberWillArriveAt" in input) {
        existing.memberWillArriveAt = membership.memberWillArriveAt;
      }
      await existing.save({ session });
      membership = existing;

      // Both racing requests were for the same never-before-seen user, so at
      // most one of them should ever consume a spot. `reservedSpot` here can
      // only be true when this request itself is answering `going` (that's
      // the only case that reserves one before the save above). If the other
      // request had already won and made this person `going` first, our own
      // reservation was redundant — give it back; the merged row is already
      // `going` from the single spot the winner reserved.
      if (reservedSpot && existingWasAlreadyGoing) {
        await releaseGoingSpot(event._id, session);
        reservedSpot = false;
      }
    }

    if (leavingGoing) {
      await releaseGoingSpot(event._id, session);
    }

    if (rsvpStatusChanged && nextRsvpStatus) {
      await createEventRsvpChangeNotification({
        eventId: String(event._id),
        hostId: String(event.hostId),
        attendeeId: userId,
        eventTitle: event.title,
        rsvpStatus: nextRsvpStatus,
        session,
      });
    }

    return membership;
  });
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
    removedAt: null,
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
