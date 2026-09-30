import { randomBytes } from "node:crypto";
import { InviteLink } from "#models/index";
import type { ResolveInviteLinkBody } from "#schemas/inviteLinkSchemas";
import { hasAnyBlockBetweenUsers } from "#services/blockService";
import { sendConnectionRequest } from "#services/connectionService";
import {
  getContactRelationship,
  publicContactProfile,
  type ContactRelationship,
} from "#services/contactRelationshipService";
import { getUsersByIds } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";

// An invite link is the group-chat way to add someone (#124): valid for a
// week, usable by many people, revocable by its owner, and opening it only
// sends the owner a connection request. See models/InviteLink.ts.

const TOKEN_BYTES = 32;
export const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const notFound = () => new AppError("Invite link not found", 404, "INVITE_LINK_NOT_FOUND");

// A request the viewer already sent stays pending; an incoming one is
// accepted by sending one back (sendConnectionRequest's reverse-pending path).
const canConnect = (relationship: ContactRelationship) =>
  relationship === "none" || relationship === "pending_incoming";

const toInviteLinkDto = (link: { token: string; expiresAt: Date }) => ({
  token: link.token,
  expiresAt: link.expiresAt,
  expiresInSeconds: Math.max(0, Math.floor((link.expiresAt.getTime() - Date.now()) / 1000)),
});

const createInviteLink = async (userId: string) => {
  const link = await InviteLink.create({
    userId: toObjectId(userId),
    token: randomBytes(TOKEN_BYTES).toString("base64url"),
    expiresAt: new Date(Date.now() + INVITE_LINK_TTL_MS),
    revokedAt: null,
  });

  return toInviteLinkDto(link);
};

/** The caller's live invite link, issuing a fresh one if none is live. */
export const getMyInviteLink = async (userId: string) => {
  const existing = await InviteLink.findOne({
    userId: toObjectId(userId),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ expiresAt: -1 })
    .lean();

  return existing ? toInviteLinkDto(existing) : createInviteLink(userId);
};

/** Revokes every live link the caller has and issues a new one. */
export const resetMyInviteLink = async (userId: string) => {
  await InviteLink.updateMany(
    { userId: toObjectId(userId), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return createInviteLink(userId);
};

export const resolveInviteLink = async (viewerId: string, input: ResolveInviteLinkBody) => {
  const link = await InviteLink.findOne({ token: input.token }).lean();

  // Revoked reads exactly like a link that never existed.
  if (!link || link.revokedAt) {
    throw notFound();
  }

  if (link.expiresAt <= new Date()) {
    throw new AppError("Invite link expired", 410, "INVITE_LINK_EXPIRED");
  }

  const ownerId = link.userId.toString();

  if (viewerId !== ownerId && (await hasAnyBlockBetweenUsers(viewerId, ownerId))) {
    throw notFound();
  }

  const user = (await getUsersByIds([ownerId])).get(ownerId);

  if (!user) {
    throw notFound();
  }

  let relationship = await getContactRelationship(viewerId, ownerId);
  let connectionResult: Awaited<ReturnType<typeof sendConnectionRequest>> | null = null;

  if (input.connect && canConnect(relationship)) {
    connectionResult = await sendConnectionRequest(viewerId, {
      receiverId: ownerId,
      type: "shared_invitation",
    });
    relationship = await getContactRelationship(viewerId, ownerId);
  }

  return {
    profile: publicContactProfile(user),
    relationship,
    canConnect: canConnect(relationship),
    expiresAt: link.expiresAt,
    connection: connectionResult
      ? {
          processed: connectionResult.processed,
          delivered: connectionResult.delivered,
          autoAccepted:
            "autoAccepted" in connectionResult ? Boolean(connectionResult.autoAccepted) : false,
        }
      : null,
  };
};
