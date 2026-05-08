import * as inboxService from "#services/inboxService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

export const getMyInbox = asyncHandler(async (req, res) => {
  const data = await inboxService.getMyInbox(getAuthenticatedUserId(req));

  res.json({ data });
});
