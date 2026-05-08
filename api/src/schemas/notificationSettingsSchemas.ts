import { z } from "zod";

const hhMmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:mm 24-hour format");

export const updateNotificationSettingsBodySchema = z
  .object({
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: hhMmSchema.optional(),
    quietHoursEnd: hhMmSchema.optional(),
    eventReminders: z.boolean().optional(),
    invitationNotifications: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateNotificationSettingsBody = z.infer<typeof updateNotificationSettingsBodySchema>;
