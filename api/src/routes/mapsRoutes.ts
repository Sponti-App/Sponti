import { Router } from "express";
import { mapsController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { computeRouteBodySchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.post(
  "/route",
  validateRequest({ body: computeRouteBodySchema }),
  mapsController.computeRoute
);

export default router;
