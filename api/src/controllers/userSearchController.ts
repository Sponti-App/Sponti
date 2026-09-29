import type { SearchUsersQuery } from "#schemas/userSearchSchemas";
import * as userDirectoryService from "#services/userDirectoryService";
import * as userProfileService from "#services/userProfileService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId, getRouteParam } from "#utils/requestUser";

export const searchUsers = asyncHandler(async (req, res) => {
  const data = await userDirectoryService.searchUsers(
    getAuthenticatedUserId(req),
    req.query as unknown as SearchUsersQuery
  );

  res.json({ data });
});

export const getProfileByUsername = asyncHandler(async (req, res) => {
  const data = await userProfileService.getProfileByUsername(
    getAuthenticatedUserId(req),
    getRouteParam(req, "username")
  );

  res.json({ data });
});
