import type { PublicMapEventsQuery } from "#schemas/publicSchemas";
import * as contactPreviewService from "#services/contactPreviewService";
import * as publicMapService from "#services/publicMapService";
import { asyncHandler } from "#utils/asyncHandler";

export const getContactPreview = asyncHandler(async (req, res) => {
  const data = await contactPreviewService.getContactPreview(req.body);

  res.set("Cache-Control", "no-store");
  res.json({ data });
});

export const getPublicMapEvents = asyncHandler(async (req, res) => {
  const data = await publicMapService.getPublicMapEvents(
    req.query as unknown as PublicMapEventsQuery
  );

  res.set("Cache-Control", "no-store");
  res.json({ data });
});
