import { Router } from "express";
import { login, logout, me, refresh, register } from "#controllers";
import { requireAuth, validateBody } from "#middleware";
import { loginSchema, logoutSchema, refreshTokenSchema, registerSchema } from "#schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", validateBody(refreshTokenSchema), refresh);
router.post("/logout", requireAuth, validateBody(logoutSchema), logout);
router.get("/me", requireAuth, me);

export default router;
