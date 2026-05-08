import { z } from "zod";
import { objectIdSchema } from "#utils/objectId";

export const addCircleMemberBodySchema = z
  .object({
    userId: objectIdSchema,
  })
  .strict();

export const updateCircleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    color: z.string().trim().max(32).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export type AddCircleMemberBody = z.infer<typeof addCircleMemberBodySchema>;
export type UpdateCircleBody = z.infer<typeof updateCircleBodySchema>;
