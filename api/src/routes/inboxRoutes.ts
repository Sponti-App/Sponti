import { Router } from "express";
import { inboxController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/me", inboxController.getMyInbox);

export default router;
