import type { CreateEventUpdateBody } from "#schemas/eventSchemas";
import * as eventUpdateService from "#services/eventUpdateService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId, getRouteParam } from "#utils/requestUser";

export const listEventUpdates = asyncHandler(async (req, res) => {
  const data = await eventUpdateService.listEventUpdates(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId")
  );

  res.json({ data });
});

export const createEventUpdate = asyncHandler(async (req, res) => {
  const data = await eventUpdateService.createEventUpdate(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId"),
    req.body as CreateEventUpdateBody
  );

  res.status(201).json({ data });
});

export const deleteEventUpdate = asyncHandler(async (req, res) => {
  const data = await eventUpdateService.deleteEventUpdate(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId"),
    getRouteParam(req, "updateId")
  );

  res.json({ data });
});
