import { z } from "zod";
import { CIRCLE_TYPES } from "#models/Circle";
import { objectIdSchema } from "#utils/objectId";

const circleTypeSchema = z.enum(CIRCLE_TYPES);

export const createCircleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    color: z.string().trim().max(32).nullable().optional(),
    type: circleTypeSchema.default("close"),
    icon: z.string().trim().max(32).nullable().optional(),
    memberIds: z.array(objectIdSchema).default([]),
  })
  .strict();

export const addCircleMemberBodySchema = z
  .object({
    userId: objectIdSchema,
  })
  .strict();

export const updateCircleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    color: z.string().trim().max(32).nullable().optional(),
    type: circleTypeSchema.optional(),
    icon: z.string().trim().max(32).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateCircleBody = z.infer<typeof createCircleBodySchema>;
export type AddCircleMemberBody = z.infer<typeof addCircleMemberBodySchema>;
export type UpdateCircleBody = z.infer<typeof updateCircleBodySchema>;
