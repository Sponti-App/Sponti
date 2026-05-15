import type {
  ActiveMapEventsQuery,
  CreateEventBody,
  GetEventsQuery,
  MyUpcomingEventsQuery,
  UpcomingCalendarEventsQuery,
  UpdateEventBody,
  UpdateMyEventMembershipBody,
} from "#schemas/eventSchemas";
import * as eventService from "#services/eventService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId, getRouteParam } from "#utils/requestUser";

export const createEvent = asyncHandler(async (req, res) => {
  const data = await eventService.createEvent(
    getAuthenticatedUserId(req),
    req.body as CreateEventBody
  );

  res.status(201).json({ data });
});

export const getEvents = asyncHandler(async (req, res) => {
  const result = await eventService.getEvents(
    getAuthenticatedUserId(req),
    req.query as unknown as GetEventsQuery
  );

  res.json(result);
});

export const getEventById = asyncHandler(async (req, res) => {
  const data = await eventService.getEventById(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId")
  );

  res.json({ data });
});

export const getMyUpcomingEvents = asyncHandler(async (req, res) => {
  const data = await eventService.getMyUpcomingEvents(
    getAuthenticatedUserId(req),
    req.query as unknown as MyUpcomingEventsQuery
  );

  res.json({ data });
});

export const updateEvent = asyncHandler(async (req, res) => {
  const data = await eventService.updateEvent(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId"),
    req.body as UpdateEventBody
  );

  res.json({ data });
});

export const cancelEvent = asyncHandler(async (req, res) => {
  const data = await eventService.cancelEvent(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId")
  );

  res.json({ data });
});

export const reactivateEvent = asyncHandler(async (req, res) => {
  const data = await eventService.reactivateEvent(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId")
  );

  res.json({ data });
});

export const updateMyEventMembership = asyncHandler(async (req, res) => {
  const data = await eventService.updateMyEventMembership(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId"),
    req.body as UpdateMyEventMembershipBody
  );

  res.json({ data });
});

export const getActiveMapEvents = asyncHandler(async (req, res) => {
  const data = await eventService.getActiveMapEvents(
    getAuthenticatedUserId(req),
    req.query as unknown as ActiveMapEventsQuery
  );

  res.json({ data });
});

export const getUpcomingCalendarEvents = asyncHandler(async (req, res) => {
  const result = await eventService.getUpcomingCalendarEvents(
    getAuthenticatedUserId(req),
    req.query as unknown as UpcomingCalendarEventsQuery
  );

  res.json(result);
});
