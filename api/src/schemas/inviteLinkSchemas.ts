import { z } from "zod";

// Tokens are base64url from randomBytes; bound the input so junk never
// reaches a database query.
export const contactTokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const emptyInviteLinkBodySchema = z.object({}).strict();

export const resolveInviteLinkBodySchema = z
  .object({
    token: contactTokenSchema,
    connect: z.boolean().optional().default(false),
  })
  .strict();

export type ResolveInviteLinkBody = z.infer<typeof resolveInviteLinkBodySchema>;
