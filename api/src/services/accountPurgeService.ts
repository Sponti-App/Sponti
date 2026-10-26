import type { Types } from "mongoose";
import {
  Block,
  Circle,
  CircleMember,
  Connection,
  Event,
  EventInviteLink,
  EventMember,
  EventUpdate,
  InviteLink,
  Notification,
  NotificationSettings,
  PendingEventInvite,
  QrContactToken,
} from "#models/index";
import { cancelEvent } from "#services/eventService";
import { getUsersCollection } from "#services/userDirectoryService";

// #449: the api's half of deleting an account. DELETE /auth/me on the
// auth-server ends the sessions, removes the photo and leaves a scrubbed user
// document with `deletedAt` set; #542's filter already hides everything that
// person hosts. This erases everything the api holds about them, then removes
// that tombstone.
//
// It runs on a timer in the api process (server.ts) and is idempotent: a run
// that fails halfway is finished by the next one. The tombstone is only removed
// once `deletedAt` is older than TOMBSTONE_GRACE_MS. Until then their last
// access token (15 min) could still write something, and later runs erase it.
//
// What goes:
// - their flares: live and upcoming ones are cancelled first, so guests get
//   the usual "flare cancelled" notice (Patrick, 2026-10-14). Then the flares,
//   their guest lists, threads and other notifications about them.
// - their RSVPs and thread posts on other flares; "invited by" on others'
//   guest lists is cleared.
// - connections and blocks either way, their circles, their place in other
//   people's circles, notifications to or from them, invite links (friend and
//   flare, and invites waiting on them), QR tokens and notification settings.
// The cancellation notices stay with the guests who got them, with no actor.

export const PURGE_INTERVAL_MS = 5 * 60_000;
export const TOMBSTONE_GRACE_MS = 20 * 60_000;

export type PurgeSummary = { userId: string; tombstoneRemoved: boolean };

const purgeOne = async (userId: Types.ObjectId, now: Date) => {
  const hosted = await Event.find({ hostId: userId }).select("_id status liveUntil").lean();

  for (const event of hosted) {
    if (event.status === "active" && new Date(event.liveUntil) > now) {
      await cancelEvent(userId.toString(), String(event._id));
    }
  }

  const hostedIds = hosted.map((event) => event._id);
  const circleIds = await Circle.find({ ownerId: userId }).distinct("_id");

  await Promise.all([
    EventMember.deleteMany({ $or: [{ eventId: { $in: hostedIds } }, { userId }] }),
    EventMember.updateMany({ invitedBy: userId }, { $set: { invitedBy: null } }),
    EventUpdate.deleteMany({ $or: [{ eventId: { $in: hostedIds } }, { authorId: userId }] }),
    Notification.deleteMany({
      $or: [
        { userId },
        { actorId: userId, type: { $ne: "event_cancelled" } },
        { targetId: { $in: hostedIds }, type: { $ne: "event_cancelled" } },
      ],
    }),
    Notification.updateMany(
      { actorId: userId, type: "event_cancelled" },
      { $set: { actorId: null } }
    ),
    Connection.deleteMany({ $or: [{ requesterId: userId }, { receiverId: userId }] }),
    Block.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
    CircleMember.deleteMany({
      $or: [{ circleId: { $in: circleIds } }, { ownerId: userId }, { userId }],
    }),
    InviteLink.deleteMany({ userId }),
    EventInviteLink.deleteMany({ $or: [{ eventId: { $in: hostedIds } }, { hostId: userId }] }),
    PendingEventInvite.deleteMany({
      $or: [{ eventId: { $in: hostedIds } }, { hostId: userId }, { guestId: userId }],
    }),
    QrContactToken.deleteMany({ userId }),
    NotificationSettings.deleteMany({ userId }),
  ]);

  await Promise.all([Event.deleteMany({ hostId: userId }), Circle.deleteMany({ ownerId: userId })]);
};

/** One purge pass over every account deleted on the auth-server. */
export const purgeDeletedAccounts = async (now = new Date()): Promise<PurgeSummary[]> => {
  const tombstones = await getUsersCollection()
    .find({ deletedAt: { $ne: null } }, { projection: { _id: 1, deletedAt: 1 } })
    .toArray();
  const summaries: PurgeSummary[] = [];

  for (const tombstone of tombstones) {
    const userId = tombstone._id as unknown as Types.ObjectId;
    await purgeOne(userId, now);

    const settled = now.getTime() - new Date(tombstone.deletedAt).getTime() >= TOMBSTONE_GRACE_MS;
    if (settled) await getUsersCollection().deleteOne({ _id: userId, deletedAt: { $ne: null } });
    summaries.push({ userId: userId.toString(), tombstoneRemoved: settled });
  }

  return summaries;
};

/** Runs the purge now and every PURGE_INTERVAL_MS. Failures are logged, then retried. */
export const startAccountPurge = () => {
  const run = () =>
    purgeDeletedAccounts()
      .then((summaries) => {
        if (summaries.length > 0) {
          console.log(`[account-purge] purged ${summaries.length} deleted account(s)`);
        }
      })
      .catch((error: unknown) => {
        console.error("[account-purge] failed, retrying next run:", error);
      });

  void run();
  return setInterval(run, PURGE_INTERVAL_MS);
};
