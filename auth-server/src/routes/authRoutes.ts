import { Router } from "express";
import { login, logout, me, register } from "#controllers";
import { requireAuth, validateBody } from "#middleware";
import { loginSchema, registerSchema } from "#schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);

export default router;
