import * as qrContactTokenService from "#services/qrContactTokenService";
import { asyncHandler } from "#utils/asyncHandler";

export const createQrContactToken = asyncHandler(async (_req, res) => {
  const data = await qrContactTokenService.createQrContactToken();

  res.status(201).json({ data });
});

export const resolveQrContactToken = asyncHandler(async (_req, res) => {
  const data = await qrContactTokenService.resolveQrContactToken();

  res.json({ data });
});
