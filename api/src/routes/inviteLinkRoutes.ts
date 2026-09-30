import { Router } from "express";
import { inviteLinkController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { emptyInviteLinkBodySchema, resolveInviteLinkBodySchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get("/me", inviteLinkController.getMyInviteLink);
router.post(
  "/me/reset",
  validateRequest({ body: emptyInviteLinkBodySchema }),
  inviteLinkController.resetMyInviteLink
);
router.post(
  "/resolve",
  validateRequest({ body: resolveInviteLinkBodySchema }),
  inviteLinkController.resolveInviteLink
);

export default router;
