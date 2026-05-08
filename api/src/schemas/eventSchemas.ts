import { z } from "zod";
import { paginationQuerySchema } from "#utils/pagination";
import { objectIdSchema } from "#utils/objectId";
import { MAX_GUEST_INVITE_LIMIT } from "#models/Event";
import { isoDateSchema, optionalIsoDateSchema } from "./commonSchemas.js";

const eventVisibilitySchema = z.enum(["public", "private"]);
const eventStatusSchema = z.enum(["active", "cancelled", "completed"]);
const eventRoleInputSchema = z.enum(["admin", "guest"]);

const locationSchema = z
  .object({
    type: z.literal("Point"),
    coordinates: z
      .tuple([
        z.number().min(-180, "Longitude must be at least -180").max(180),
        z.number().min(-90, "Latitude must be at least -90").max(90),
      ])
      .readonly(),
  })
  .strict();

const eventMemberInviteSchema = z
  .object({
    userId: objectIdSchema,
    role: eventRoleInputSchema.default("guest"),
    canInviteGuests: z.boolean().optional(),
  })
  .strict();

const eventCircleInviteSchema = z
  .object({
    circleId: objectIdSchema,
    role: eventRoleInputSchema.default("guest"),
    canInviteGuests: z.boolean().optional(),
  })
  .strict();

export const createEventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    startAt: isoDateSchema,
    endAt: isoDateSchema,
    locationName: z.string().trim().min(1).max(160),
    locationAddress: z.string().trim().max(240).nullable().optional(),
    location: locationSchema,
    visibility: eventVisibilitySchema.default("private"),
    allowGuestInvites: z.boolean().default(false),
    guestInviteLimit: z.coerce.number().int().min(0).max(MAX_GUEST_INVITE_LIMIT).default(0),
    members: z.array(eventMemberInviteSchema).default([]),
    circles: z.array(eventCircleInviteSchema).default([]),
  })
  .strict()
  .refine((body) => body.endAt.getTime() > body.startAt.getTime(), {
    message: "endAt must be strictly after startAt",
    path: ["endAt"],
  });

export const updateEventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startAt: isoDateSchema.optional(),
    endAt: isoDateSchema.optional(),
    locationName: z.string().trim().min(1).max(160).optional(),
    locationAddress: z.string().trim().max(240).nullable().optional(),
    location: locationSchema.optional(),
    visibility: eventVisibilitySchema.optional(),
    allowGuestInvites: z.boolean().optional(),
    guestInviteLimit: z.coerce.number().int().min(0).max(MAX_GUEST_INVITE_LIMIT).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(
    (body) => {
      if (!body.startAt || !body.endAt) {
        return true;
      }

      return body.endAt.getTime() > body.startAt.getTime();
    },
    {
      message: "endAt must be strictly after startAt",
      path: ["endAt"],
    }
  );

export const updateMyEventMembershipBodySchema = z
  .object({
    rsvpStatus: z.enum(["going", "maybe", "declined"]).optional(),
    memberWillArriveAt: isoDateSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export const getEventsQuerySchema = paginationQuerySchema
  .extend({
    hostId: objectIdSchema.optional(),
    status: eventStatusSchema.optional(),
    visibility: eventVisibilitySchema.optional(),
    startAtFrom: optionalIsoDateSchema,
    startAtTo: optionalIsoDateSchema,
  })
  .strict();

export const activeMapEventsQuerySchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
    radiusKm: z.coerce.number().positive().max(1000).default(25),
  })
  .strict();

export const upcomingCalendarEventsQuerySchema = paginationQuerySchema;

export type CreateEventBody = z.infer<typeof createEventBodySchema>;
export type UpdateEventBody = z.infer<typeof updateEventBodySchema>;
export type UpdateMyEventMembershipBody = z.infer<typeof updateMyEventMembershipBodySchema>;
export type GetEventsQuery = z.infer<typeof getEventsQuerySchema>;
export type ActiveMapEventsQuery = z.infer<typeof activeMapEventsQuerySchema>;
export type UpcomingCalendarEventsQuery = z.infer<typeof upcomingCalendarEventsQuerySchema>;
