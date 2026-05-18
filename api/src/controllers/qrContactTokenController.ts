import * as qrContactTokenService from "#services/qrContactTokenService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

export const createQrContactToken = asyncHandler(async (req, res) => {
  const data = await qrContactTokenService.createQrContactToken(getAuthenticatedUserId(req));

  res.status(201).json({ data });
});

export const resolveQrContactToken = asyncHandler(async (req, res) => {
  const data = await qrContactTokenService.resolveQrContactToken(
    getAuthenticatedUserId(req),
    req.body
  );

  res.json({ data });
});
