import { Router } from "express";
import { userSearchController } from "#controllers/index";
import { requireAuth } from "#middleware/auth";
import { validateRequest } from "#middleware/validateRequest";
import { searchUsersQuerySchema } from "#schemas/index";

const router = Router();

router.use(requireAuth);

router.get(
  "/search",
  validateRequest({ query: searchUsersQuerySchema }),
  userSearchController.searchUsers
);

export default router;
