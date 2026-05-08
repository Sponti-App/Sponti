import type { RequestHandler } from "express";
import { hasAnyBlockBetweenUsers } from "#services/blockService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

export const silentlyHandleBlockedConnectionRequest: RequestHandler = asyncHandler(
  async (req, res, next) => {
    const requesterId = getAuthenticatedUserId(req);
    const receiverId = req.body?.receiverId;

    if (typeof receiverId !== "string" || requesterId === receiverId) {
      return next();
    }

    if (await hasAnyBlockBetweenUsers(requesterId, receiverId)) {
      // Do not disclose block state to the requester.
      return res.status(202).json({ data: { processed: true } });
    }

    return next();
  }
);
