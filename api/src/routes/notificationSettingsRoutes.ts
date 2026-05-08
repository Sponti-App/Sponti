import { Router } from "express";
import { notificationSettingsController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { updateNotificationSettingsBodySchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get("/me", notificationSettingsController.getMyNotificationSettings);
router.patch(
  "/me",
  validateRequest({ body: updateNotificationSettingsBodySchema }),
  notificationSettingsController.updateMyNotificationSettings
);

export default router;
