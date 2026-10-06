import { z } from "zod";
import { contactTokenSchema } from "./inviteLinkSchemas.js";

export const contactPreviewBodySchema = z
  .object({
    kind: z.enum(["qr", "invite"]),
    token: contactTokenSchema,
  })
  .strict();

export type ContactPreviewBody = z.infer<typeof contactPreviewBodySchema>;

// Query for GET /public/events/map (#425). Same centre-plus-radius shape as
// the signed-in map query, with a tighter radius cap: this one is reachable by
// anyone, so one request can't sweep a whole country.
export const publicMapEventsQuerySchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
    radiusKm: z.coerce.number().positive().max(100).default(25),
  })
  .strict();

export type PublicMapEventsQuery = z.infer<typeof publicMapEventsQuerySchema>;
