import type { UpdateNotificationSettingsBody } from "#schemas/notificationSettingsSchemas";
import * as notificationSettingsService from "#services/notificationSettingsService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

export const getMyNotificationSettings = asyncHandler(async (req, res) => {
  const data = await notificationSettingsService.getMyNotificationSettings(
    getAuthenticatedUserId(req)
  );

  res.json({ data });
});

export const updateMyNotificationSettings = asyncHandler(async (req, res) => {
  const data = await notificationSettingsService.updateMyNotificationSettings(
    getAuthenticatedUserId(req),
    req.body as UpdateNotificationSettingsBody
  );

  res.json({ data });
});
