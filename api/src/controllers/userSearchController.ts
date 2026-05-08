import type { SearchUsersQuery } from "#schemas/userSearchSchemas";
import * as userDirectoryService from "#services/userDirectoryService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

export const searchUsers = asyncHandler(async (req, res) => {
  const data = await userDirectoryService.searchUsers(
    getAuthenticatedUserId(req),
    req.query as unknown as SearchUsersQuery
  );

  res.json({ data });
});
