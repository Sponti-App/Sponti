import { Router } from "express";
import { notificationController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
  readNotificationsBatchBodySchema,
} from "#schemas/index";

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
router.patch("/read-all", notificationController.markAllNotificationsRead);
router.patch(
  "/:id/dismiss",
  validateRequest({ params: notificationIdParamSchema }),
  notificationController.dismissNotification
);

export default router;
