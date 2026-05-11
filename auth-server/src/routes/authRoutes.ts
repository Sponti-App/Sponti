import { Router } from "express";
import { login, logout, me, register, forgotPassword, resetPassword } from "#controllers";
import { requireAuth, validateBody } from "#middleware";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "#schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);
router.post("/forgot-password", validateBody(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validateBody(resetPasswordSchema), resetPassword);

export default router;
