import { Router } from "express";
import { notificationController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { getNotificationsQuerySchema, readNotificationsBatchBodySchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest({ query: getNotificationsQuerySchema }),
  notificationController.getNotifications
);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch(
  "/read-batch",
  validateRequest({ body: readNotificationsBatchBodySchema }),
  notificationController.markNotificationsReadBatch
);

export default router;
