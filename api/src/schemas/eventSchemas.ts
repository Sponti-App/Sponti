import { z } from "zod";
import { paginationQuerySchema } from "#utils/pagination";
import { objectIdSchema } from "#utils/objectId";
import { EVENT_GUEST_INVITE_MODES, EVENT_TYPES, MAX_GUEST_INVITE_LIMIT } from "#models/Event";
import { EVENT_UPDATE_BODY_MAX_LENGTH } from "#models/EventUpdate";
import { isoDateSchema, optionalIsoDateSchema } from "./commonSchemas.js";

const eventVisibilitySchema = z.enum(["public", "private"]);
const eventStatusSchema = z.enum(["active", "cancelled", "completed"]);
const eventTypeSchema = z.enum(EVENT_TYPES);
const eventRoleInputSchema = z.enum(["admin", "guest"]);
const eventGuestInviteModeSchema = z.enum(EVENT_GUEST_INVITE_MODES);
const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");

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
  })
  .strict();

const eventCircleInviteSchema = z
  .object({
    circleId: objectIdSchema,
    role: eventRoleInputSchema.default("guest"),
  })
  .strict();

export const createEventBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    type: eventTypeSchema.default("hangout"),
    startAt: isoDateSchema,
    endAt: isoDateSchema,
    locationName: z.string().trim().min(1).max(160),
    locationAddress: z.string().trim().max(240).nullable().optional(),
    location: locationSchema,
    visibility: eventVisibilitySchema.default("private"),
    allowGuestInvites: eventGuestInviteModeSchema.default("none"),
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
    type: eventTypeSchema.optional(),
    startAt: isoDateSchema.optional(),
    endAt: isoDateSchema.optional(),
    locationName: z.string().trim().min(1).max(160).optional(),
    locationAddress: z.string().trim().max(240).nullable().optional(),
    location: locationSchema.optional(),
    visibility: eventVisibilitySchema.optional(),
    allowGuestInvites: eventGuestInviteModeSchema.optional(),
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

export const eventMemberParamSchema = z
  .object({
    eventId: objectIdSchema,
    userId: objectIdSchema,
  })
  .strict();

export const eventUpdateParamSchema = z
  .object({
    eventId: objectIdSchema,
    updateId: objectIdSchema,
  })
  .strict();

// Plain text, trimmed before the length check, so whitespace-only is empty.
export const createEventUpdateBodySchema = z
  .object({
    body: z.string().trim().min(1).max(EVENT_UPDATE_BODY_MAX_LENGTH),
  })
  .strict();

export const inviteEventMembersBodySchema = z
  .object({
    members: z.array(eventMemberInviteSchema).default([]),
    circles: z.array(eventCircleInviteSchema).default([]),
  })
  .strict()
  .refine((body) => body.members.length > 0 || body.circles.length > 0, {
    message: "At least one member or circle must be provided",
  });

const arrivalStatusSchema = z.enum(["on_time", "running_late"]);

export const updateMyEventMembershipBodySchema = z
  .object({
    rsvpStatus: z.enum(["going", "declined"]).optional(),
    memberWillArriveAt: isoDateSchema.nullable().optional(),
    // #211: "on time" / "running late" for a flare that starts within the
    // hour but hasn't started yet. Mutually exclusive with
    // memberWillArriveAt — sending a real value for both at once is invalid;
    // setting one (to a real value) clears the other server-side.
    arrivalStatus: arrivalStatusSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  })
  .refine((body) => !(body.memberWillArriveAt != null && body.arrivalStatus != null), {
    message: "memberWillArriveAt and arrivalStatus are mutually exclusive",
    path: ["arrivalStatus"],
  });

export const getEventsQuerySchema = paginationQuerySchema
  .extend({
    hostId: objectIdSchema.optional(),
    hostedByMe: booleanQuerySchema.optional(),
    status: eventStatusSchema.optional(),
    visibility: eventVisibilitySchema.optional(),
    startAtFrom: optionalIsoDateSchema,
    startAtTo: optionalIsoDateSchema,
    endAtFrom: optionalIsoDateSchema,
    endAtTo: optionalIsoDateSchema,
  })
  .strict();

export const myUpcomingEventsQuerySchema = z
  .object({
    endAtFrom: optionalIsoDateSchema,
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
export type CreateEventUpdateBody = z.infer<typeof createEventUpdateBodySchema>;
export type InviteEventMembersBody = z.infer<typeof inviteEventMembersBodySchema>;
export type UpdateMyEventMembershipBody = z.infer<typeof updateMyEventMembershipBodySchema>;
export type GetEventsQuery = z.infer<typeof getEventsQuerySchema>;
export type MyUpcomingEventsQuery = z.infer<typeof myUpcomingEventsQuerySchema>;
export type ActiveMapEventsQuery = z.infer<typeof activeMapEventsQuerySchema>;
export type UpcomingCalendarEventsQuery = z.infer<typeof upcomingCalendarEventsQuerySchema>;
