import { z } from "zod";

// #639: a browser PushSubscription as `subscription.toJSON()` gives it, plus
// the device's timezone for quiet hours.
export const registerPushSubscriptionBodySchema = z
  .object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(256),
    }),
    timeZone: z.string().max(64).optional(),
  })
  .strict();

export const removePushSubscriptionBodySchema = z
  .object({ endpoint: z.string().url().max(2048) })
  .strict();

export type RegisterPushSubscriptionBody = z.infer<typeof registerPushSubscriptionBodySchema>;
export type RemovePushSubscriptionBody = z.infer<typeof removePushSubscriptionBodySchema>;
