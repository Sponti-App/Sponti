import { type ClientSession, type Types } from "mongoose";
import { Event, EventMember, PendingEventInvite } from "#models/index";
import { hasAnyBlockBetweenUsers } from "#services/blockService";
import { createEventInvitationNotifications } from "#services/notificationService";
import { getInactiveUserIds } from "#services/userDirectoryService";
import { toObjectId } from "#utils/objectId";

// Invites to invite-only flares that wait on the host's friend-request answer
// (#616; the model is PendingEventInvite). Kept apart from the redeem flow so
// connectionService can call it without an import cycle.

/**
 * Invites `guestId` to one flare as an individual guest: a member row in the
 * `invited` state plus the usual invitation notification. Someone who already
 * has a member row is left alone, including a guest the host removed
 * (`removedAt` set): a removal is only undone by the host inviting them again,
 * and a link must not undo it. Returns true when a row was created.
 *
 * The caller has already decided this person may be invited (they hold the
 * link, and either are friends with the host or the host just accepted them).
 */
export const inviteGuestToFlare = async (
  event: {
    _id: Types.ObjectId;
    hostId: Types.ObjectId;
    title: string;
    allowGuestInvites?: string | null;
  },
  guestId: string,
  session?: ClientSession
): Promise<boolean> => {
  const guestObjectId = toObjectId(guestId);
  const result = await EventMember.updateOne(
    { eventId: event._id, userId: guestObjectId },
    {
      $setOnInsert: {
        invitedBy: event.hostId,
        role: "guest",
        rsvpStatus: "invited",
        canInviteGuests: (event.allowGuestInvites ?? "none") !== "none",
      },
    },
    { upsert: true, session }
  );

  if (result.upsertedCount === 0) {
    return false;
  }

  await createEventInvitationNotifications({
    eventId: String(event._id),
    hostId: String(event.hostId),
    eventTitle: event.title,
    inviteeIds: [guestId],
    session,
  });

  return true;
};

/**
 * `guestId` has waited for `hostId` and the two are now connected: invite the
 * guest to every flare of the host's they are pending on, then clear those
 * rows. A flare that has ended, was cancelled or lost its host grants nothing,
 * and neither does a blocked pair. Returns the ids of the flares they were
 * invited to.
 */
const grantPendingInvites = async (
  hostId: string,
  guestId: string,
  session?: ClientSession
): Promise<string[]> => {
  const hostObjectId = toObjectId(hostId);
  const guestObjectId = toObjectId(guestId);
  const pending = await PendingEventInvite.find({ hostId: hostObjectId, guestId: guestObjectId })
    .session(session ?? null)
    .lean();

  if (pending.length === 0) {
    return [];
  }

  const blocked = await hasAnyBlockBetweenUsers(hostId, guestId);
  const inactiveHosts = blocked ? [] : await getInactiveUserIds();
  const hostGone = inactiveHosts.includes(hostId);
  const events =
    blocked || hostGone
      ? []
      : await Event.find({
          _id: { $in: pending.map((row) => row.eventId) },
          hostId: hostObjectId,
          status: "active",
          liveUntil: { $gt: new Date() },
        })
          .select("_id hostId title allowGuestInvites")
          .session(session ?? null)
          .lean();

  const invited: string[] = [];

  for (const event of events) {
    if (await inviteGuestToFlare(event, guestId, session)) {
      invited.push(String(event._id));
    }
  }

  await PendingEventInvite.deleteMany({ _id: { $in: pending.map((row) => row._id) } }, { session });

  return invited;
};

/**
 * Two people just became connected: whichever of them was waiting on the other
 * for an invite-only flare is invited to it now. Call it from every path that
 * turns a connection into `accepted`, inside that path's transaction, next to
 * `addNewFriendsToAllFriendsFlares`.
 */
export const grantPendingFlareInvites = async (
  userAId: string,
  userBId: string,
  session?: ClientSession
) => {
  if (userAId === userBId) {
    return;
  }

  await grantPendingInvites(userAId, userBId, session);
  await grantPendingInvites(userBId, userAId, session);
};

/**
 * The host declined the guest's request, or the guest took it back: the
 * pending invites between them lapse and grant nothing, and the guest is not
 * told which it was.
 */
export const lapsePendingFlareInvites = async (
  hostId: string,
  guestId: string,
  session?: ClientSession
) => {
  await PendingEventInvite.deleteMany(
    { hostId: toObjectId(hostId), guestId: toObjectId(guestId) },
    { session }
  );
};
