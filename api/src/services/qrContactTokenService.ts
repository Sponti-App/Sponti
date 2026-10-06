import { createHash, randomBytes } from "node:crypto";
import { QrContactToken } from "#models/index";
import type { ResolveQrContactTokenBody } from "#schemas/qrContactTokenSchemas";
import { connectInPerson, sendConnectionRequest } from "#services/connectionService";
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
// #441: signing up or in on a phone can take longer than the code lives. For
// this long after expiry the code still names its owner to a signed-in viewer
// and lets them send a friend REQUEST (the invite-link path), never an instant
// connection: only a live code proves the two people are together. Past it the
// code is dead for good.
export const QR_EXPIRED_REQUEST_GRACE_MS = 24 * 60 * 60 * 1000;

export const hashQrContactToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const hashToken = hashQrContactToken;

const notFound = () =>
  new AppError("QR contact token not found", 404, "QR_CONTACT_TOKEN_NOT_FOUND");

// Scanning in person resolves any pending request, in either direction.
// An expired code only sends a request, so a request already sent is final.
const canConnect = (relationship: Relationship, expired: boolean) =>
  relationship === "none" ||
  relationship === "pending_incoming" ||
  (relationship === "pending_outgoing" && !expired);

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

  const expired = token.expiresAt <= now;

  if (expired && now.getTime() - token.expiresAt.getTime() > QR_EXPIRED_REQUEST_GRACE_MS) {
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
  let requestResult: Awaited<ReturnType<typeof sendConnectionRequest>> | null = null;

  if (input.connect && canConnect(relationship, expired)) {
    if (expired) {
      requestResult = await sendConnectionRequest(viewerId, {
        receiverId: ownerId,
        type: "shared_invitation",
      });
    } else {
      connectionResult = await connectInPerson(viewerId, ownerId);
    }
    ({ relationship } = await getRelationship(viewerId, ownerId));
  }

  return {
    profile: publicContactProfile(user),
    relationship,
    canConnect: canConnect(relationship, expired),
    expiresAt: token.expiresAt,
    // True when the code has run out but is still inside the grace window:
    // the viewer can send a request, not connect on the spot.
    expired,
    connection: connectionResult
      ? {
          processed: connectionResult.processed,
          delivered: connectionResult.delivered,
          // Kept for response-shape compatibility: a QR connect never leaves
          // a request pending, so this is true whenever it connected.
          autoAccepted: connectionResult.connected,
        }
      : requestResult
        ? {
            processed: requestResult.processed,
            delivered: requestResult.delivered,
            autoAccepted:
              "autoAccepted" in requestResult ? Boolean(requestResult.autoAccepted) : false,
          }
        : null,
  };
};
