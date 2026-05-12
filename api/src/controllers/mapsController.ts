import type { ComputeRouteBody } from "#schemas/mapsSchemas";
import * as mapsService from "#services/mapsService";
import { asyncHandler } from "#utils/asyncHandler";

export const computeRoute = asyncHandler(async (req, res) => {
  const data = await mapsService.computeRoute(req.body as ComputeRouteBody);
  res.json({ data });
});
