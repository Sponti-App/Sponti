import { z } from "zod";
import { paginationQuerySchema } from "#utils/pagination";

export const searchUsersQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(80),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;

// Loose on purpose: usernames are validated when they're set (auth-server);
// this only keeps the lookup to plausible username characters.
export const usernameParamSchema = z
  .object({
    username: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9._-]+$/),
  })
  .strict();

// "tap to list" mutual friends on someone's profile (#288).
export const mutualFriendsQuerySchema = paginationQuerySchema
  .extend({
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type MutualFriendsQuery = z.infer<typeof mutualFriendsQuerySchema>;
