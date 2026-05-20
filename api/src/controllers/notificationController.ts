import type {
  GetNotificationsQuery,
  ReadNotificationsBatchBody,
} from "#schemas/notificationSchemas";
import * as notificationService from "#services/notificationService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

export const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.getNotifications(
    getAuthenticatedUserId(req),
    req.query as unknown as GetNotificationsQuery
  );

  res.json(result);
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const data = await notificationService.getUnreadCount(getAuthenticatedUserId(req));

  res.json({ data });
});

export const markNotificationsReadBatch = asyncHandler(async (req, res) => {
  const data = await notificationService.markNotificationsReadBatch(
    getAuthenticatedUserId(req),
    req.body as ReadNotificationsBatchBody
  );

  res.json({ data });
});
