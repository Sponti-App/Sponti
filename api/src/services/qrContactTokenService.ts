import { createHash, randomBytes } from "node:crypto";
import { Connection, QrContactToken } from "#models/index";
import type { ResolveQrContactTokenBody } from "#schemas/qrContactTokenSchemas";
import { hasAnyBlockBetweenUsers } from "#services/blockService";
import { sendConnectionRequest } from "#services/connectionService";
import { getUsersByIds, type UserSummary } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 15 * 60 * 1000;

type QrRelationship = "self" | "connected" | "pending_outgoing" | "pending_incoming" | "none";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const publicProfile = (user: UserSummary) => ({
  id: user._id,
  username: user.username,
  displayName: user.displayName ?? user.username,
  avatarUrl: user.avatarUrl ?? null,
});

const notFound = () =>
  new AppError("QR contact token not found", 404, "QR_CONTACT_TOKEN_NOT_FOUND");

const getRelationship = async (viewerId: string, ownerId: string): Promise<QrRelationship> => {
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

const canConnect = (relationship: QrRelationship) =>
  relationship === "none" || relationship === "pending_incoming";

export const createQrContactToken = async (userId: string) => {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const userObjectId = toObjectId(userId);

  await QrContactToken.create({
    userId: userObjectId,
    tokenHash: hashToken(token),
    expiresAt,
    isActive: true,
  });

  return {
    token,
    expiresAt,
    expiresInSeconds: Math.floor(TOKEN_TTL_MS / 1000),
  };
};

export const resolveQrContactToken = async (
  viewerId: string,
  input: ResolveQrContactTokenBody
) => {
  const token = await QrContactToken.findOne({
    tokenHash: hashToken(input.token),
    isActive: true,
  }).lean();

  if (!token) {
    throw notFound();
  }

  const ownerId = token.userId.toString();
  const now = new Date();

  if (token.expiresAt <= now) {
    await QrContactToken.updateOne({ _id: token._id }, { $set: { isActive: false } });
    throw new AppError("QR contact token expired", 410, "QR_CONTACT_TOKEN_EXPIRED");
  }

  if (viewerId !== ownerId && (await hasAnyBlockBetweenUsers(viewerId, ownerId))) {
    throw notFound();
  }

  const users = await getUsersByIds([ownerId]);
  const user = users.get(ownerId);

  if (!user) {
    throw notFound();
  }

  let relationship = await getRelationship(viewerId, ownerId);
  let connectionResult: Awaited<ReturnType<typeof sendConnectionRequest>> | null = null;

  if (input.connect && canConnect(relationship)) {
    connectionResult = await sendConnectionRequest(viewerId, {
      receiverId: ownerId,
      type: "qr",
    });
    relationship = await getRelationship(viewerId, ownerId);
  }

  return {
    profile: publicProfile(user),
    relationship,
    canConnect: canConnect(relationship),
    expiresAt: token.expiresAt,
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
