import { Router } from "express";
import { blockController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { userIdParamSchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.post("/:userId", validateRequest({ params: userIdParamSchema }), blockController.blockUser);
router.delete(
  "/:userId",
  validateRequest({ params: userIdParamSchema }),
  blockController.unblockUser
);
router.get("/", blockController.getBlockedUsers);

export default router;
