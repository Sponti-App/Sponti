import { z } from "zod";
import { objectIdSchema } from "#utils/objectId";

export const getNotificationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(10).default(10),
    cursor: z.string().trim().min(1).optional(),
  })
  .strict();

export const readNotificationsBatchBodySchema = z
  .object({
    notificationIds: z.array(objectIdSchema).min(1).max(10),
  })
  .strict();

export const notificationIdParamSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;
export type ReadNotificationsBatchBody = z.infer<typeof readNotificationsBatchBodySchema>;
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
