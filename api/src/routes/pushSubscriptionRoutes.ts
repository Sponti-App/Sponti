import { Router } from "express";
import { pushSubscriptionController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import {
  registerPushSubscriptionBodySchema,
  removePushSubscriptionBodySchema,
} from "#schemas/index";

// #639: this device's web push subscription.
const router = Router();

router.use(requireAuth);

router.get("/vapid-public-key", pushSubscriptionController.getVapidPublicKey);
router.post(
  "/",
  validateRequest({ body: registerPushSubscriptionBodySchema }),
  pushSubscriptionController.registerPushSubscription
);
router.delete(
  "/",
  validateRequest({ body: removePushSubscriptionBodySchema }),
  pushSubscriptionController.removePushSubscription
);

export default router;
