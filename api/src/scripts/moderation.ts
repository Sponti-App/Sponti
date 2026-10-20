import mongoose, { Types } from "mongoose";
import { Event } from "#models/index";

// Hand moderation for the open tester round (#542). There is no report button
// or admin screen; a teammate runs these on the server, following
// deploy/netcup/MODERATION.md.
//
// - suspend: sets `suspendedAt` on the user and deletes their refresh tokens.
//   The auth-server refuses them a new session, and every flare list (signed
//   in or out) hides their flares. Their current access token runs out within
//   15 minutes.
// - unsuspend: clears `suspendedAt`. Their flares come back; they sign in
//   again.
// - hide-flare: sets one flare to `completed`. Every map and list shows only
//   `active` flares, and a host can only reactivate a `cancelled` one, so it
//   stays down. Guests aren't notified.
//
// Users and refresh tokens are the auth-server's collections in the same
// database. Only ids, usernames and counts are printed, never emails.

const users = () => mongoose.connection.db!.collection("users");
const refreshTokens = () => mongoose.connection.db!.collection("refreshtokens");

export type ModerationResult = { lines: string[]; changed: boolean };

const findUser = async (username: string) => {
  const user = await users().findOne(
    { username: username.replace(/^@/, "").toLowerCase() },
    { projection: { _id: 1, username: 1, suspendedAt: 1 } }
  );
  if (!user) throw new Error(`no user with username ${username}`);
  return user as { _id: Types.ObjectId; username: string; suspendedAt?: Date | null };
};

export const suspendUser = async (username: string, apply: boolean): Promise<ModerationResult> => {
  const user = await findUser(username);
  const [tokens, liveFlares] = await Promise.all([
    refreshTokens().countDocuments({ userId: user._id }),
    Event.countDocuments({ hostId: user._id, status: "active", liveUntil: { $gt: new Date() } }),
  ]);
  const lines = [
    `user: @${user.username} (${user._id.toString()})`,
    user.suspendedAt
      ? `already suspended since ${user.suspendedAt.toISOString()}`
      : "not suspended",
    `refresh tokens to delete: ${tokens}`,
    `active flares that will be hidden: ${liveFlares}`,
  ];
  if (!apply) return { lines: [...lines, "dry run: nothing changed"], changed: false };

  await users().updateOne(
    { _id: user._id },
    { $set: { suspendedAt: user.suspendedAt ?? new Date() } }
  );
  await refreshTokens().deleteMany({ userId: user._id });
  return { lines: [...lines, "applied: suspended, sessions ended"], changed: true };
};

export const unsuspendUser = async (
  username: string,
  apply: boolean
): Promise<ModerationResult> => {
  const user = await findUser(username);
  const lines = [
    `user: @${user.username} (${user._id.toString()})`,
    user.suspendedAt ? `suspended since ${user.suspendedAt.toISOString()}` : "not suspended",
  ];
  if (!apply) return { lines: [...lines, "dry run: nothing changed"], changed: false };

  await users().updateOne({ _id: user._id }, { $set: { suspendedAt: null } });
  return { lines: [...lines, "applied: unsuspended"], changed: true };
};

export const hideFlare = async (eventId: string, apply: boolean): Promise<ModerationResult> => {
  if (!Types.ObjectId.isValid(eventId)) throw new Error(`not a flare id: ${eventId}`);
  const event = await Event.findById(eventId).select("_id hostId status liveUntil").lean();
  if (!event) throw new Error(`no flare with id ${eventId}`);
  const lines = [
    `flare: ${String(event._id)} by host ${String(event.hostId)}`,
    `status: ${event.status}, live until ${new Date(event.liveUntil).toISOString()}`,
  ];
  if (!apply) return { lines: [...lines, "dry run: nothing changed"], changed: false };

  await Event.updateOne({ _id: event._id }, { $set: { status: "completed" } });
  return { lines: [...lines, "applied: hidden (status completed)"], changed: true };
};
