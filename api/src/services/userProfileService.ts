import { Block, Connection } from "#models/index";
import { getUserIdentityByUsername } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";

// How the viewer stands with the person whose profile they opened. Same
// vocabulary as the QR contact flow, plus "blocked" (the viewer blocked them).
export type ProfileRelationship =
  | "self"
  | "connected"
  | "pending_outgoing"
  | "pending_incoming"
  | "blocked"
  | "none";

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// One error for "no such user" and "that user blocked you", so a profile
// lookup can't tell a blocked viewer anything an unknown username wouldn't.
const notFound = () => new AppError("User not found", 404, "USER_NOT_FOUND");

type ProfileView = {
  profile: PublicProfile;
  relationship: ProfileRelationship;
  // The pending request, so the viewer can cancel (outgoing) or accept
  // (incoming) it. Null for every other relationship.
  connectionId: string | null;
};

const getConnectionRelationship = async (
  viewerId: string,
  otherId: string
): Promise<Omit<ProfileView, "profile">> => {
  const viewerObjectId = toObjectId(viewerId);
  const otherObjectId = toObjectId(otherId);
  const connections = await Connection.find({
    $or: [
      { requesterId: viewerObjectId, receiverId: otherObjectId },
      { requesterId: otherObjectId, receiverId: viewerObjectId },
    ],
  })
    .select("requesterId status")
    .lean();

  if (connections.some((c) => c.status === "accepted")) {
    return { relationship: "connected", connectionId: null };
  }

  const pending = connections.filter((c) => c.status === "pending");
  const outgoing = pending.find((c) => c.requesterId.toString() === viewerId);
  if (outgoing) {
    return { relationship: "pending_outgoing", connectionId: String(outgoing._id) };
  }
  const incoming = pending.find((c) => c.requesterId.toString() === otherId);
  if (incoming) {
    return { relationship: "pending_incoming", connectionId: String(incoming._id) };
  }

  // A rejected request reads as no relationship: the requester is never told
  // they were turned down (retrying still fails with CONNECTION_REJECTED).
  return { relationship: "none", connectionId: null };
};

/**
 * Someone else's profile, opened by username (#199): the host link on a
 * flare, a circles row, a typed URL. Profile visibility is discovery-only
 * (see auth-server CONTEXT.md), so it only ever affects search, never this:
 * anyone signed in who has the username sees the same public identity
 * (display name, @username, avatar) whether the profile is public or private.
 * Nothing else about the user is returned.
 *
 * - The viewer blocked them: identity + "blocked", so they can unblock.
 * - They blocked the viewer: 404, the same as an unknown username.
 */
export const getProfileByUsername = async (
  viewerId: string,
  username: string
): Promise<ProfileView> => {
  const user = await getUserIdentityByUsername(username);
  if (!user) throw notFound();

  const profile: PublicProfile = {
    id: user._id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl ?? null,
  };

  if (user._id === viewerId) {
    return { profile, relationship: "self", connectionId: null };
  }

  const viewerObjectId = toObjectId(viewerId);
  const otherObjectId = toObjectId(user._id);
  const blocks = await Block.find({
    $or: [
      { blockerId: viewerObjectId, blockedId: otherObjectId },
      { blockerId: otherObjectId, blockedId: viewerObjectId },
    ],
  })
    .select("blockerId")
    .lean();

  if (blocks.some((b) => b.blockerId.toString() === viewerId)) {
    return { profile, relationship: "blocked", connectionId: null };
  }
  if (blocks.length > 0) throw notFound();

  return { profile, ...(await getConnectionRelationship(viewerId, user._id)) };
};
