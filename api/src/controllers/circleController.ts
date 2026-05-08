import type { AddCircleMemberBody, UpdateCircleBody } from "#schemas/circleSchemas";
import * as circleService from "#services/circleService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId, getRouteParam } from "#utils/requestUser";

export const getMyCircles = asyncHandler(async (req, res) => {
  const data = await circleService.getMyCircles(getAuthenticatedUserId(req));

  res.json({ data });
});

export const updateCircle = asyncHandler(async (req, res) => {
  const data = await circleService.updateCircle(
    getAuthenticatedUserId(req),
    getRouteParam(req, "id"),
    req.body as UpdateCircleBody
  );

  res.json({ data });
});

export const addCircleMember = asyncHandler(async (req, res) => {
  const data = await circleService.addCircleMember(
    getAuthenticatedUserId(req),
    getRouteParam(req, "id"),
    req.body as AddCircleMemberBody
  );

  res.status(201).json({ data });
});

export const removeCircleMember = asyncHandler(async (req, res) => {
  await circleService.removeCircleMember(
    getAuthenticatedUserId(req),
    getRouteParam(req, "id"),
    getRouteParam(req, "userId")
  );

  res.status(204).send();
});
