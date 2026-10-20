import { Router } from "express";
import { flareInviteController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { flareInviteTokenBodySchema } from "#schemas/index";

// A flare's invite link (#616), signed-in side: where the viewer stands with a
// link, and "i'm in". The host's own link is under /events/:eventId/invite-link
// and the signed-out preview under /public. POST (not GET) so the token travels
// in the body and stays out of URLs and access logs.
const router = Router();

router.use(requireAuth);

router.post(
  "/status",
  validateRequest({ body: flareInviteTokenBodySchema }),
  flareInviteController.getFlareInviteStatus
);
router.post(
  "/redeem",
  validateRequest({ body: flareInviteTokenBodySchema }),
  flareInviteController.redeemFlareInvite
);

export default router;
