import type { PublicMapEventsQuery } from "#schemas/publicSchemas";
import * as contactPreviewService from "#services/contactPreviewService";
import * as flareInviteService from "#services/flareInviteService";
import * as publicMapService from "#services/publicMapService";
import { AppError } from "#utils/AppError";
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

export const getPublicMapEvent = asyncHandler(async (req, res) => {
  const data = await publicMapService.getPublicMapEvent(req.params.id as string);
  if (!data) throw new AppError("Flare not found", 404, "EVENT_NOT_FOUND");

  res.set("Cache-Control", "no-store");
  res.json({ data });
});

export const getFlareInvitePreview = asyncHandler(async (req, res) => {
  const data = await flareInviteService.getFlareInvitePreview(req.body.token);

  res.set("Cache-Control", "no-store");
  res.json({ data });
});
