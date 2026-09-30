import { Connection } from "#models/index";
import type { UserSummary } from "#services/userDirectoryService";
import { toObjectId } from "#utils/objectId";

// Shared by the two contact entry points — the in-person QR code and the
// group-chat invite link — so both describe "who is this to me" the same way.

export type ContactRelationship =
  | "self"
  | "connected"
  | "pending_outgoing"
  | "pending_incoming"
  | "none";

export const publicContactProfile = (user: UserSummary) => ({
  id: user._id,
  username: user.username,
  displayName: user.displayName ?? user.username,
  avatarUrl: user.avatarUrl ?? null,
});

export const getContactRelationship = async (
  viewerId: string,
  ownerId: string
): Promise<ContactRelationship> => {
  if (viewerId === ownerId) return "self";

  const viewerObjectId = toObjectId(viewerId);
  const ownerObjectId = toObjectId(ownerId);
  const connections = await Connection.find({
    $or: [
      { requesterId: viewerObjectId, receiverId: ownerObjectId },
      { requesterId: ownerObjectId, receiverId: viewerObjectId },
    ],
  }).lean();

  if (connections.some((connection) => connection.status === "accepted")) {
    return "connected";
  }

  if (
    connections.some(
      (connection) =>
        connection.status === "pending" && connection.requesterId.toString() === viewerId
    )
  ) {
    return "pending_outgoing";
  }

  if (
    connections.some(
      (connection) =>
        connection.status === "pending" && connection.receiverId.toString() === viewerId
    )
  ) {
    return "pending_incoming";
  }

  return "none";
};
