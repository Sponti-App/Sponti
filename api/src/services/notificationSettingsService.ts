import { NotificationSettings } from "#models/index";
import type { UpdateNotificationSettingsBody } from "#schemas/notificationSettingsSchemas";
import { toObjectId } from "#utils/objectId";

export const getMyNotificationSettings = async (userId: string) => {
  return NotificationSettings.findOneAndUpdate(
    { userId: toObjectId(userId) },
    { $setOnInsert: { userId: toObjectId(userId) } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

export const updateMyNotificationSettings = async (
  userId: string,
  input: UpdateNotificationSettingsBody
) => {
  return NotificationSettings.findOneAndUpdate(
    { userId: toObjectId(userId) },
    {
      $set: input,
      $setOnInsert: { userId: toObjectId(userId) },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  ).lean();
};
