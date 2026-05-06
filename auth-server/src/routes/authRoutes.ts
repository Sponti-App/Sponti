import { Router } from "express";
import { login, logout, me, register } from "#controllers";
import { validateBody } from "#middleware";
import { loginSchema, registerSchema } from "#schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/logout", logout);
router.get("/me", me);

export default router;
