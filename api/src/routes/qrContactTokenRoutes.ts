import { Router } from "express";
import { qrContactTokenController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { createQrContactTokenBodySchema, resolveQrContactTokenBodySchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  validateRequest({ body: createQrContactTokenBodySchema }),
  qrContactTokenController.createQrContactToken
);
router.post(
  "/resolve",
  validateRequest({ body: resolveQrContactTokenBodySchema }),
  qrContactTokenController.resolveQrContactToken
);

export default router;
