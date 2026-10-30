import type {
  RegisterPushSubscriptionBody,
  RemovePushSubscriptionBody,
} from "#schemas/pushSubscriptionSchemas";
import * as pushService from "#services/pushService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId } from "#utils/requestUser";

// `publicKey: null` means push is off on this server, so the spa hides it.
export const getVapidPublicKey = asyncHandler(async (_req, res) => {
  res.json({ data: { publicKey: pushService.getVapidPublicKey() } });
});

export const registerPushSubscription = asyncHandler(async (req, res) => {
  await pushService.registerPushSubscription(
    getAuthenticatedUserId(req),
    req.body as RegisterPushSubscriptionBody
  );
  res.status(204).end();
});

export const removePushSubscription = asyncHandler(async (req, res) => {
  await pushService.removePushSubscription(
    getAuthenticatedUserId(req),
    (req.body as RemovePushSubscriptionBody).endpoint
  );
  res.status(204).end();
});
