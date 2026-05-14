import { Router } from "express";
import { login, logout, me, register, refresh, forgotPassword, resetPassword, updateAvatar, updateProfile } from "#controllers";
import { requireAuth, validateBody, uploadAvatar } from "#middleware";
import { loginSchema, registerSchema, refreshTokenSchema, logoutSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } from "#schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", validateBody(refreshTokenSchema), refresh);
router.post("/logout", requireAuth, validateBody(logoutSchema), logout);
router.get("/me", requireAuth, me);
router.post("/forgot-password", validateBody(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validateBody(resetPasswordSchema), resetPassword);
router.patch("/me/avatar",
    requireAuth,
    uploadAvatar.single("avatar"),
    updateAvatar
);
router.patch("/me/profile",
    requireAuth,
    validateBody(updateProfileSchema),
    updateProfile);

export default router;
