import { z } from "zod";
import { paginationQuerySchema } from "#utils/pagination";
import { objectIdSchema } from "#utils/objectId";

export const idParamSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export const userIdParamSchema = z
  .object({
    userId: objectIdSchema,
  })
  .strict();

export const eventIdParamSchema = z
  .object({
    eventId: objectIdSchema,
  })
  .strict();

export const circleIdParamSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export const circleMemberParamSchema = z
  .object({
    id: objectIdSchema,
    userId: objectIdSchema,
  })
  .strict();

export const isoDateSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

export const optionalIsoDateSchema = isoDateSchema.optional();

export const paginatedQuerySchema = paginationQuerySchema;
