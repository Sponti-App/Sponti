import { Router } from "express";
import { userSearchController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { searchUsersQuerySchema, usernameParamSchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get(
  "/search",
  validateRequest({ query: searchUsersQuerySchema }),
  userSearchController.searchUsers
);
router.get(
  "/by-username/:username",
  validateRequest({ params: usernameParamSchema }),
  userSearchController.getProfileByUsername
);

export default router;
