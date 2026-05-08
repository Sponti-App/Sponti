import { Router } from "express";
import { connectionController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { silentlyHandleBlockedConnectionRequest } from "#middleware/blockGuards";
import { validateRequest } from "#middleware/validateRequest";
import {
  getConnectionsQuerySchema,
  idParamSchema,
  respondToConnectionRequestBodySchema,
  sendConnectionRequestBodySchema,
} from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.post(
  "/request",
  validateRequest({ body: sendConnectionRequestBodySchema }),
  silentlyHandleBlockedConnectionRequest,
  connectionController.sendConnectionRequest
);
router.get(
  "/",
  validateRequest({ query: getConnectionsQuerySchema }),
  connectionController.getConnections
);
router.patch(
  "/:id/respond",
  validateRequest({ params: idParamSchema, body: respondToConnectionRequestBodySchema }),
  connectionController.respondToConnectionRequest
);
router.delete(
  "/:id",
  validateRequest({ params: idParamSchema }),
  connectionController.deleteConnection
);

export default router;
