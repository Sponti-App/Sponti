import { z } from "zod";
import { contactTokenSchema } from "./inviteLinkSchemas.js";

export const contactPreviewBodySchema = z
  .object({
    kind: z.enum(["qr", "invite"]),
    token: contactTokenSchema,
  })
  .strict();

export type ContactPreviewBody = z.infer<typeof contactPreviewBodySchema>;
