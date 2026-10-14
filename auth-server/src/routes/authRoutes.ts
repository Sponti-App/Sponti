import { Router } from "express";
import { googleLogin, login, logout, me, register, refresh, forgotPassword, resetPassword, updateAvatar, updateProfile, deleteAccount } from "#controllers";
import { requireAuth, validateBody, uploadAvatar } from "#middleware";
import { googleLoginSchema, loginSchema, registerSchema, refreshTokenSchema, logoutSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, deleteAccountSchema } from "#schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/google", validateBody(googleLoginSchema), googleLogin);
router.post("/refresh", validateBody(refreshTokenSchema), refresh);
router.post("/logout", validateBody(logoutSchema), logout);
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
// #449: delete my account (the auth-server's half; api purges the rest).
router.delete("/me",
    requireAuth,
    validateBody(deleteAccountSchema),
    deleteAccount);

export default router;
