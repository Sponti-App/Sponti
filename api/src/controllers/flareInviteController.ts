import * as flareInviteService from "#services/flareInviteService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId, getRouteParam } from "#utils/requestUser";

export const getHostInviteLink = asyncHandler(async (req, res) => {
  const data = await flareInviteService.getHostInviteLink(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId")
  );

  res.set("Cache-Control", "no-store");
  res.json({ data });
});

export const resetHostInviteLink = asyncHandler(async (req, res) => {
  const data = await flareInviteService.resetHostInviteLink(
    getAuthenticatedUserId(req),
    getRouteParam(req, "eventId")
  );

  res.set("Cache-Control", "no-store");
  res.status(201).json({ data });
});

export const getFlareInviteStatus = asyncHandler(async (req, res) => {
  const data = await flareInviteService.getFlareInviteStatus(
    getAuthenticatedUserId(req),
    req.body.token
  );

  res.set("Cache-Control", "no-store");
  res.json({ data });
});

export const redeemFlareInvite = asyncHandler(async (req, res) => {
  const data = await flareInviteService.redeemFlareInvite(
    getAuthenticatedUserId(req),
    req.body.token
  );

  res.set("Cache-Control", "no-store");
  res.json({ data });
});
