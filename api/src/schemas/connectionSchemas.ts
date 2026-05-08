import { z } from "zod";
import { paginationQuerySchema } from "#utils/pagination";
import { objectIdSchema } from "#utils/objectId";

const connectionStatusSchema = z.enum(["pending", "accepted", "rejected"]);
const connectionTypeSchema = z.enum(["qr", "shared_invitation", "email_invitation"]);

export const sendConnectionRequestBodySchema = z
  .object({
    receiverId: objectIdSchema,
    type: connectionTypeSchema.default("shared_invitation"),
  })
  .strict();

export const respondToConnectionRequestBodySchema = z
  .object({
    status: z.enum(["accepted", "rejected"]),
  })
  .strict();

export const getConnectionsQuerySchema = paginationQuerySchema
  .extend({
    status: connectionStatusSchema.optional(),
    type: connectionTypeSchema.optional(),
    direction: z.enum(["incoming", "outgoing", "all"]).default("outgoing"),
  })
  .strict();

export type SendConnectionRequestBody = z.infer<typeof sendConnectionRequestBodySchema>;
export type RespondToConnectionRequestBody = z.infer<typeof respondToConnectionRequestBodySchema>;
export type GetConnectionsQuery = z.infer<typeof getConnectionsQuerySchema>;
