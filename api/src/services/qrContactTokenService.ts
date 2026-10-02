import { createHash, randomBytes } from "node:crypto";
import { QrContactToken } from "#models/index";
import type { ResolveQrContactTokenBody } from "#schemas/qrContactTokenSchemas";
import { connectInPerson } from "#services/connectionService";
import {
  getRelationship,
  publicContactProfile,
  type Relationship,
} from "#services/relationshipService";
import { getUsersByIds } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";

const TOKEN_BYTES = 32;
// Deliberately short: a live QR code proves the two people are together, and
// that is what makes connecting instantly on scan safe (#124). Anything meant
// to be pasted into a group chat is an invite link instead.
const TOKEN_TTL_MS = 15 * 60 * 1000;

export const hashQrContactToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const hashToken = hashQrContactToken;

const notFound = () =>
  new AppError("QR contact token not found", 404, "QR_CONTACT_TOKEN_NOT_FOUND");

// Scanning in person resolves any pending request, in either direction.
const canConnect = (relationship: Relationship) =>
  relationship === "none" ||
  relationship === "pending_incoming" ||
  relationship === "pending_outgoing";

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

export const resolveQrContactToken = async (viewerId: string, input: ResolveQrContactTokenBody) => {
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

  // Blocks either way read exactly like a token that never existed.
  let { relationship } = await getRelationship(viewerId, ownerId);

  if (relationship === "blocked") {
    throw notFound();
  }

  const users = await getUsersByIds([ownerId]);
  const user = users.get(ownerId);

  if (!user) {
    throw notFound();
  }

  let connectionResult: Awaited<ReturnType<typeof connectInPerson>> | null = null;

  if (input.connect && canConnect(relationship)) {
    connectionResult = await connectInPerson(viewerId, ownerId);
    ({ relationship } = await getRelationship(viewerId, ownerId));
  }

  return {
    profile: publicContactProfile(user),
    relationship,
    canConnect: canConnect(relationship),
    expiresAt: token.expiresAt,
    connection: connectionResult
      ? {
          processed: connectionResult.processed,
          delivered: connectionResult.delivered,
          // Kept for response-shape compatibility: a QR connect never leaves
          // a request pending, so this is true whenever it connected.
          autoAccepted: connectionResult.connected,
        }
      : null,
  };
};
