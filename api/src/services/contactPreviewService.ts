import { InviteLink, QrContactToken } from "#models/index";
import type { ContactPreviewBody } from "#schemas/publicSchemas";
import { hashQrContactToken } from "#services/qrContactTokenService";
import { getUsersByIds } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";

// Unauthenticated: lets the sign-up screen say "join {name} on sponti" to
// someone who opened a QR or invite link before having an account (#124).
//
// Exposure is deliberately minimal — the owner's display name and nothing
// else (no id, username, avatar or expiry). Every failure (unknown, expired,
// revoked, deactivated, owner missing, no display name) is the same 404, so
// the endpoint can't be used to tell those states apart. There is no viewer,
// so there is no block check here; the authenticated resolve endpoints still
// enforce blocks before anything is shown or any connection is made.

const notFound = () => new AppError("Contact preview not found", 404, "CONTACT_PREVIEW_NOT_FOUND");

const findOwnerId = async ({ kind, token }: ContactPreviewBody) => {
  const now = new Date();

  if (kind === "qr") {
    const qrToken = await QrContactToken.findOne({
      tokenHash: hashQrContactToken(token),
      isActive: true,
      expiresAt: { $gt: now },
    })
      .select("userId")
      .lean();

    return qrToken?.userId.toString() ?? null;
  }

  const link = await InviteLink.findOne({
    token,
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .select("userId")
    .lean();

  return link?.userId.toString() ?? null;
};

export const getContactPreview = async (input: ContactPreviewBody) => {
  const ownerId = await findOwnerId(input);

  if (!ownerId) {
    throw notFound();
  }

  const owner = (await getUsersByIds([ownerId])).get(ownerId);
  const displayName = owner?.displayName?.trim();

  if (!displayName) {
    throw notFound();
  }

  return { displayName };
};
