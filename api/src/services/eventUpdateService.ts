import { type ClientSession } from "mongoose";
import { Event, EventMember, EventUpdate } from "#models/index";
import type { CreateEventUpdateBody } from "#schemas/eventSchemas";
import { getBlockedInviteeIds, getBlockedRelationshipUserIds } from "#services/blockService";
import {
  buildAccessibleEventFilter,
  toEventUserIdentity,
  withConditions,
  type EventUserIdentity,
} from "#services/eventService";
import { createEventUpdateNotifications } from "#services/notificationService";
import { getUsersByIds, type UserSummary } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId, uniqueObjectIdStrings } from "#utils/objectId";
import { withTransactionFallback } from "#utils/transactions";

type ThreadEvent = {
  _id: ReturnType<typeof toObjectId>;
  hostId: unknown;
  title: string;
  status: string;
  endAt: Date;
};

type EventUpdateLean = {
  _id: unknown;
  eventId: unknown;
  authorId: unknown;
  body: string;
  createdAt: Date;
};

export type EventUpdateDto = {
  _id: string;
  eventId: string;
  authorId: string;
  author: EventUserIdentity;
  body: string;
  createdAt: string;
  // True when the viewer may delete this update: its author or the host.
  canDelete: boolean;
};

const toEventUpdateDto = (
  update: EventUpdateLean,
  users: Map<string, UserSummary>,
  viewerId: string,
  viewerIsHost: boolean
): EventUpdateDto => {
  const authorId = String(update.authorId);

  return {
    _id: String(update._id),
    eventId: String(update.eventId),
    authorId,
    author: toEventUserIdentity(authorId, users.get(authorId)),
    body: update.body,
    createdAt: new Date(update.createdAt).toISOString(),
    canDelete: viewerIsHost || authorId === viewerId,
  };
};

/**
 * The thread's access gate (#140): only the host and guests whose RSVP is
 * `going` may read or post. Visibility comes from the same accessible-event
 * filter as `GET /events/:id`, so removed guests and anyone in a block
 * relationship with the host are shut out as well.
 *
 * Someone who can't see the flare and was never on it gets the same 404 as the
 * event itself, so a private flare isn't disclosed. Everyone else who is
 * refused (invited, declined or removed guests, blocked members, strangers on a
 * public flare) gets 403 `EVENT_THREAD_FORBIDDEN`.
 */
const resolveThreadAccess = async (userId: string, eventId: string) => {
  const eventObjectId = toObjectId(eventId);
  const accessibleFilter = await buildAccessibleEventFilter(userId);
  const [event, membership] = await Promise.all([
    Event.findOne(withConditions(accessibleFilter, { _id: eventObjectId }))
      .select("_id hostId title status endAt")
      .lean<ThreadEvent>(),
    EventMember.findOne({ eventId: eventObjectId, userId: toObjectId(userId) })
      .select("rsvpStatus removedAt")
      .lean(),
  ]);

  if (!event) {
    if (membership) {
      throw new AppError(
        "Only the host and going guests can see updates",
        403,
        "EVENT_THREAD_FORBIDDEN"
      );
    }

    throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
  }

  const isHost = String(event.hostId) === userId;
  const isGoingGuest =
    membership !== null && !membership.removedAt && membership.rsvpStatus === "going";

  if (!isHost && !isGoingGuest) {
    throw new AppError(
      "Only the host and going guests can see updates",
      403,
      "EVENT_THREAD_FORBIDDEN"
    );
  }

  return { event, isHost };
};

/**
 * Lists a flare's updates, oldest first, each with its author's public
 * profile. Deleted updates, and updates by anyone in a block relationship with
 * the viewer, are left out.
 */
export const listEventUpdates = async (userId: string, eventId: string) => {
  const { event, isHost } = await resolveThreadAccess(userId, eventId);
  const blockedUserIds = await getBlockedRelationshipUserIds(userId);
  const filter: Record<string, unknown> = { eventId: event._id, deletedAt: null };

  if (blockedUserIds.length > 0) {
    filter.authorId = { $nin: blockedUserIds.map(toObjectId) };
  }

  const updates = await EventUpdate.find(filter)
    .select("_id eventId authorId body createdAt")
    .sort({ createdAt: 1, _id: 1 })
    .lean<EventUpdateLean[]>();
  const users = await getUsersByIds(
    uniqueObjectIdStrings(updates.map((update) => String(update.authorId)))
  );

  return updates.map((update) => toEventUpdateDto(update, users, userId, isHost));
};

/**
 * Posts an update. Only the host and going guests can post, and only while the
 * flare is active and hasn't ended; otherwise 409 `EVENT_THREAD_CLOSED`. A
 * host's update notifies every going guest once; a guest's notifies nobody.
 */
export const createEventUpdate = async (
  userId: string,
  eventId: string,
  input: CreateEventUpdateBody
) => {
  const { event, isHost } = await resolveThreadAccess(userId, eventId);

  if (event.status !== "active" || event.endAt.getTime() <= Date.now()) {
    throw new AppError(
      "Updates can only be posted to active flares that haven't ended",
      409,
      "EVENT_THREAD_CLOSED"
    );
  }

  const update = await withTransactionFallback(async (session?: ClientSession) => {
    const [created] = await EventUpdate.create(
      [{ eventId: event._id, authorId: toObjectId(userId), body: input.body }],
      { session }
    );

    if (!created) {
      throw new AppError("Update could not be posted", 500, "EVENT_UPDATE_CREATE_FAILED");
    }

    if (isHost) {
      const goingGuests = (await EventMember.find({
        eventId: event._id,
        userId: { $ne: toObjectId(userId) },
        rsvpStatus: "going",
        removedAt: null,
      })
        .select("userId")
        .session(session ?? null)
        .lean()) as Array<{ userId: unknown }>;
      const guestIds = goingGuests.map((member) => String(member.userId));
      // Blocks don't take anyone off a flare, but a guest in a block
      // relationship with the host can't see it, so they aren't pinged either.
      const blockedGuestIds = await getBlockedInviteeIds(userId, guestIds);

      await createEventUpdateNotifications({
        eventId: String(event._id),
        hostId: userId,
        eventTitle: event.title,
        updateId: String(created._id),
        body: created.body,
        recipientIds: guestIds.filter((guestId) => !blockedGuestIds.has(guestId)),
        session,
      });
    }

    return created;
  });

  const users = await getUsersByIds([userId]);

  return toEventUpdateDto(update.toObject() as EventUpdateLean, users, userId, isHost);
};

/**
 * Soft-deletes an update. Allowed for its author and the flare's host, and
 * idempotent: deleting an already deleted update returns it unchanged.
 */
export const deleteEventUpdate = async (userId: string, eventId: string, updateId: string) => {
  const eventObjectId = toObjectId(eventId);
  const update = await EventUpdate.findOne({ _id: toObjectId(updateId), eventId: eventObjectId })
    .select("_id authorId deletedAt")
    .lean();

  if (!update) {
    throw new AppError("Update not found", 404, "EVENT_UPDATE_NOT_FOUND");
  }

  const isAuthor = String(update.authorId) === userId;
  const isHost =
    !isAuthor && Boolean(await Event.exists({ _id: eventObjectId, hostId: toObjectId(userId) }));

  if (!isAuthor && !isHost) {
    throw new AppError(
      "Only the author or the host can delete this update",
      403,
      "EVENT_UPDATE_DELETE_FORBIDDEN"
    );
  }

  if (update.deletedAt) {
    return { _id: String(update._id), deletedAt: new Date(update.deletedAt).toISOString() };
  }

  const deletedAt = new Date();
  const result = await EventUpdate.findOneAndUpdate(
    { _id: update._id, deletedAt: null },
    { $set: { deletedAt } },
    { returnDocument: "after" }
  )
    .select("_id deletedAt")
    .lean();
  // A concurrent delete may have won; either way the update is deleted now.
  const finalDeletedAt = result?.deletedAt ?? deletedAt;

  return { _id: String(update._id), deletedAt: new Date(finalDeletedAt).toISOString() };
};
