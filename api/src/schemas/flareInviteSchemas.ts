import { z } from "zod";
import { contactTokenSchema } from "./inviteLinkSchemas.js";

// A flare's invite token is base64url from randomBytes, like the friend invite
// link's; bound the input so junk never reaches a database query.
export const flareInviteTokenBodySchema = z.object({ token: contactTokenSchema }).strict();

export const emptyFlareInviteBodySchema = z.object({}).strict();

export type FlareInviteTokenBody = z.infer<typeof flareInviteTokenBodySchema>;
