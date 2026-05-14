import { Router } from "express";
import { circleController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import {
  addCircleMemberBodySchema,
  circleIdParamSchema,
  circleMemberParamSchema,
  createCircleBodySchema,
  updateCircleBodySchema,
} from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get("/", circleController.getMyCircles);
router.post("/", validateRequest({ body: createCircleBodySchema }), circleController.createCircle);
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
