import { Router } from "express";
import { eventController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import {
  activeMapEventsQuerySchema,
  createEventBodySchema,
  eventIdParamSchema,
  getEventsQuerySchema,
  updateEventBodySchema,
  updateMyEventMembershipBodySchema,
  upcomingCalendarEventsQuerySchema,
} from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get(
  "/map/active",
  validateRequest({ query: activeMapEventsQuerySchema }),
  eventController.getActiveMapEvents
);
router.get(
  "/calendar/upcoming",
  validateRequest({ query: upcomingCalendarEventsQuerySchema }),
  eventController.getUpcomingCalendarEvents
);
router.post("/", validateRequest({ body: createEventBodySchema }), eventController.createEvent);
router.get("/", validateRequest({ query: getEventsQuerySchema }), eventController.getEvents);
router.get(
  "/:eventId",
  validateRequest({ params: eventIdParamSchema }),
  eventController.getEventById
);
router.patch(
  "/:eventId",
  validateRequest({ params: eventIdParamSchema, body: updateEventBodySchema }),
  eventController.updateEvent
);
router.patch(
  "/:eventId/cancel",
  validateRequest({ params: eventIdParamSchema }),
  eventController.cancelEvent
);
router.patch(
  "/:eventId/me",
  validateRequest({ params: eventIdParamSchema, body: updateMyEventMembershipBodySchema }),
  eventController.updateMyEventMembership
);

export default router;
