import { Router } from "express";
import { circleController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import {
  addCircleMemberBodySchema,
  circleIdParamSchema,
  circleMemberParamSchema,
  updateCircleBodySchema,
} from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get("/", circleController.getMyCircles);
router.patch(
  "/:id",
  validateRequest({ params: circleIdParamSchema, body: updateCircleBodySchema }),
  circleController.updateCircle
);
router.post(
  "/:id/members",
  validateRequest({ params: circleIdParamSchema, body: addCircleMemberBodySchema }),
  circleController.addCircleMember
);
router.delete(
  "/:id/members/:userId",
  validateRequest({ params: circleMemberParamSchema }),
  circleController.removeCircleMember
);

export default router;
