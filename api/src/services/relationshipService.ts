import { Block, Connection } from "#models/index";
import type { UserSummary } from "#services/userDirectoryService";
import { toObjectId, uniqueObjectIdStrings } from "#utils/objectId";

// The one definition of "how are these two users related" (#267). Everything
// that asks "are these two connected?" goes through here: the QR code and
// invite link screens, someone's profile, search, circles and flare invites.
//
// Connected means an accepted connection row in BOTH directions and no block
// either way. Accepting a request, the reverse auto-accept and the in-person
// QR connect all write the mirrored pair, and blocking deletes both rows
// (#260), so real data is always symmetric. Requiring both rows means that if
// a one-sided accepted row ever exists again (a leftover from before #260, or
// a future bug), it grants nothing instead of quietly counting as a friend.

export type Relationship =
  | "self"
  | "connected"
  | "pending_outgoing"
  | "pending_incoming"
  | "blocked"
  | "none";

export type RelationshipView = {
  relationship: Relationship;
  // Only for "blocked": who placed the block. "viewer" wins when both did, so
  // the viewer can always undo their own block.
  blockedBy: "viewer" | "other" | null;
  // Only for "pending_*": the pending request, so the viewer can cancel
  // (outgoing) or accept (incoming) it.
  connectionId: string | null;
};

export const publicContactProfile = (user: UserSummary) => ({
  id: user._id,
  username: user.username,
  displayName: user.displayName ?? user.username,
  avatarUrl: user.avatarUrl ?? null,
});

/**
 * How `viewerId` stands with `otherId`, in precedence order: self, blocked
 * (either way), connected, pending_outgoing, pending_incoming, none.
 *
 * A rejected request reads as "none": the requester is never told they were
 * turned down (retrying still fails with CONNECTION_REJECTED).
 */
export const getRelationship = async (
  viewerId: string,
  otherId: string
): Promise<RelationshipView> => {
  if (viewerId === otherId) {
    return { relationship: "self", blockedBy: null, connectionId: null };
  }

  const viewerObjectId = toObjectId(viewerId);
  const otherObjectId = toObjectId(otherId);

  const [blocks, connections] = await Promise.all([
    Block.find({
      $or: [
        { blockerId: viewerObjectId, blockedId: otherObjectId },
        { blockerId: otherObjectId, blockedId: viewerObjectId },
      ],
    })
      .select("blockerId")
      .lean(),
    Connection.find({
      $or: [
        { requesterId: viewerObjectId, receiverId: otherObjectId },
        { requesterId: otherObjectId, receiverId: viewerObjectId },
      ],
    })
      .select("requesterId status")
      .lean(),
  ]);

  if (blocks.length > 0) {
    const viewerBlocked = blocks.some((block) => block.blockerId.toString() === viewerId);
    return {
      relationship: "blocked",
      blockedBy: viewerBlocked ? "viewer" : "other",
      connectionId: null,
    };
  }

  // At most one row per direction (unique requesterId + receiverId index).
  const outgoing = connections.find((c) => c.requesterId.toString() === viewerId);
  const incoming = connections.find((c) => c.requesterId.toString() === otherId);

  if (outgoing?.status === "accepted" && incoming?.status === "accepted") {
    return { relationship: "connected", blockedBy: null, connectionId: null };
  }

  if (outgoing?.status === "pending") {
    return {
      relationship: "pending_outgoing",
      blockedBy: null,
      connectionId: String(outgoing._id),
    };
  }

  if (incoming?.status === "pending") {
    return {
      relationship: "pending_incoming",
      blockedBy: null,
      connectionId: String(incoming._id),
    };
  }

  return { relationship: "none", blockedBy: null, connectionId: null };
};

/**
 * The users `userId` is connected to, by the same definition as
 * `getRelationship`: accepted rows both ways and no block either way. Pass
 * `amongUserIds` to only check those candidates (e.g. circle members or flare
 * invitees) instead of loading the whole network.
 */
export const getConnectedUserIds = async (
  userId: string,
  amongUserIds?: string[]
): Promise<Set<string>> => {
  const candidates = amongUserIds ? uniqueObjectIdStrings(amongUserIds) : undefined;

  if (candidates?.length === 0) {
    return new Set();
  }

  const userObjectId = toObjectId(userId);
  const candidateFilter = candidates ? { $in: candidates.map(toObjectId) } : undefined;

  const [outgoing, incoming, blocks] = await Promise.all([
    Connection.find({
      requesterId: userObjectId,
      status: "accepted",
      ...(candidateFilter && { receiverId: candidateFilter }),
    })
      .select("receiverId")
      .lean(),
    Connection.find({
      receiverId: userObjectId,
      status: "accepted",
      ...(candidateFilter && { requesterId: candidateFilter }),
    })
      .select("requesterId")
      .lean(),
    Block.find({ $or: [{ blockerId: userObjectId }, { blockedId: userObjectId }] })
      .select("blockerId blockedId")
      .lean(),
  ]);

  const acceptedByThem = new Set(incoming.map((row) => row.requesterId.toString()));
  const blocked = new Set(
    blocks.map((block) =>
      block.blockerId.toString() === userId
        ? block.blockedId.toString()
        : block.blockerId.toString()
    )
  );

  const connected = new Set<string>();
  for (const row of outgoing) {
    const otherId = row.receiverId.toString();
    if (acceptedByThem.has(otherId) && !blocked.has(otherId)) {
      connected.add(otherId);
    }
  }

  return connected;
};
