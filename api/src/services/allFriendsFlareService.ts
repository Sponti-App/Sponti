import { type ClientSession } from "mongoose";
import { Circle, Event, EventMember } from "#models/index";
import { hasAnyBlockBetweenUsers } from "#services/blockService";
import { createEventInvitationNotifications } from "#services/notificationService";
import { toObjectId } from "#utils/objectId";

/**
 * Adds `inviteeId` to the host's flares that went to the host's "all friends"
 * circle and haven't ended. Returns the ids of the flares they were added to.
 *
 * Someone who already has a member row is left alone, including a guest the
 * host removed (`removedAt` set): a removal is only undone by the host
 * re-inviting them. The invitee gets what an all-friends invitee gets at
 * creation (#426): the `guest` role (the host's per-circle role pick isn't
 * stored on the flare, and the api defaults it to guest) and guest-invite
 * rights from the flare's `allowGuestInvites`.
 */
const addInviteeToHostAllFriendsFlares = async (
  hostId: string,
  inviteeId: string,
  session?: ClientSession
): Promise<string[]> => {
  const hostObjectId = toObjectId(hostId);
  const inviteeObjectId = toObjectId(inviteeId);

  const allCircle = await Circle.findOne({ ownerId: hostObjectId, type: "all" })
    .select("_id")
    .session(session ?? null)
    .lean();

  if (!allCircle) {
    return [];
  }

  const events = await Event.find({
    hostId: hostObjectId,
    invitedCircleIds: allCircle._id,
    status: "active",
    endAt: { $gt: new Date() },
  })
    .select("_id title allowGuestInvites")
    .session(session ?? null)
    .lean();

  if (events.length === 0) {
    return [];
  }

  const existing = await EventMember.find({
    eventId: { $in: events.map((event) => event._id) },
    userId: inviteeObjectId,
  })
    .select("eventId")
    .session(session ?? null)
    .lean();
  const existingEventIds = new Set(existing.map((member) => String(member.eventId)));
  const targets = events.filter((event) => !existingEventIds.has(String(event._id)));

  if (targets.length === 0) {
    return [];
  }

  // Upsert rather than insert so a concurrent invite can't trip the unique
  // (eventId, userId) index; only rows we actually created are notified.
  const result = await EventMember.bulkWrite(
    targets.map((event) => ({
      updateOne: {
        filter: { eventId: event._id, userId: inviteeObjectId },
        update: {
          $setOnInsert: {
            invitedBy: hostObjectId,
            role: "guest",
            rsvpStatus: "invited",
            canInviteGuests: event.allowGuestInvites !== "none",
          },
        },
        upsert: true,
      },
    })),
    { session, ordered: true }
  );
  const addedEvents = targets.filter((_, index) => index in result.upsertedIds);

  for (const event of addedEvents) {
    await createEventInvitationNotifications({
      eventId: String(event._id),
      hostId,
      eventTitle: event.title,
      inviteeIds: [inviteeId],
      session,
    });
  }

  return addedEvents.map((event) => String(event._id));
};

/**
 * Two people just became connected: each is added as an invited member to the
 * other's active, not-ended flares that were sent to "all friends", so a
 * friend who connects while a flare is upcoming or live isn't left out (#426).
 * Custom circles are deliberately not covered (the host is offered those via
 * `getCircleUpcomingEvents`), and flares are never backfilled for people
 * connected before. A blocked pair gets nothing.
 *
 * Call it from every path that turns a connection into `accepted`, inside that
 * path's transaction. The caller vouches for the connection (its rows may not
 * be committed yet, so this doesn't re-read them); blocks are checked here.
 */
export const addNewFriendsToAllFriendsFlares = async (
  userAId: string,
  userBId: string,
  session?: ClientSession
) => {
  if (userAId === userBId || (await hasAnyBlockBetweenUsers(userAId, userBId))) {
    return;
  }

  await addInviteeToHostAllFriendsFlares(userAId, userBId, session);
  await addInviteeToHostAllFriendsFlares(userBId, userAId, session);
};
