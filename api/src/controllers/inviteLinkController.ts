import * as inviteLinkService from "#services/inviteLinkService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

export const getMyInviteLink = asyncHandler(async (req, res) => {
  const data = await inviteLinkService.getMyInviteLink(getAuthenticatedUserId(req));

  res.json({ data });
});

export const resetMyInviteLink = asyncHandler(async (req, res) => {
  const data = await inviteLinkService.resetMyInviteLink(getAuthenticatedUserId(req));

  res.status(201).json({ data });
});

export const resolveInviteLink = asyncHandler(async (req, res) => {
  const data = await inviteLinkService.resolveInviteLink(getAuthenticatedUserId(req), req.body);

  res.json({ data });
});
