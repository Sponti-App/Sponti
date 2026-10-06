import { Router } from "express";
import { publicController } from "#controllers/index";
import { createRateLimiter } from "#middleware/rateLimit";
import { validateRequest } from "#middleware/validateRequest";
import { contactPreviewBodySchema, publicMapEventsQuerySchema } from "#schemas/index";

// The only unauthenticated /api/v1 routes. Mounted ahead of requireAuth in
// app.ts. Anything added here is reachable by anyone on the internet — keep
// responses to the bare minimum and never branch on who is asking.
export const publicRoutes = Router();

// POST (not GET) so the token travels in the body and stays out of URLs and
// access logs.
publicRoutes.post(
  "/contact-preview",
  validateRequest({ body: contactPreviewBodySchema }),
  publicController.getContactPreview
);

// #425: open-to-all flares for the signed-out map. Rate-limited per client
// (60 a minute) because anyone can call it. The response is the minimal
// projection in services/publicMapService.ts.
publicRoutes.get(
  "/events/map",
  createRateLimiter({ windowMs: 60_000, max: 60 }),
  validateRequest({ query: publicMapEventsQuerySchema }),
  publicController.getPublicMapEvents
);
