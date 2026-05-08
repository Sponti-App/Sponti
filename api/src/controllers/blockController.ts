import * as blockService from "#services/blockService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId, getRouteParam } from "#utils/requestUser";

export const blockUser = asyncHandler(async (req, res) => {
  const data = await blockService.blockUser(
    getAuthenticatedUserId(req),
    getRouteParam(req, "userId")
  );

  res.status(201).json({ data });
});

export const unblockUser = asyncHandler(async (req, res) => {
  await blockService.unblockUser(getAuthenticatedUserId(req), getRouteParam(req, "userId"));

  res.status(204).send();
});

export const getBlockedUsers = asyncHandler(async (req, res) => {
  const data = await blockService.getBlockedUsers(getAuthenticatedUserId(req));

  res.json({ data });
});
