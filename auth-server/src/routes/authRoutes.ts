import { Router } from "express";
import {
    googleLogin,
    login,
    logout,
    me,
    register,
    refresh,
    forgotPassword,
    resetPassword,
    updateAvatar,
    updateProfile,
    deleteAccount,
    sendFeedback,
} from "#controllers";
import { createRateLimiter, requireAuth, validateBody, uploadAvatar } from "#middleware";
import {
    googleLoginSchema,
    loginSchema,
    registerSchema,
    refreshTokenSchema,
    logoutSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    updateProfileSchema,
    deleteAccountSchema,
    feedbackSchema,
} from "#schemas";

const router = Router();

// Feedback is mail to a real inbox, so it is limited per signed-in tester, not
// per address: a group of friends on one wifi shouldn't share a budget.
const feedbackLimit = createRateLimiter({
    windowMs: 60 * 60_000,
    max: 10,
    key: (req) => req.userId ?? null,
});

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/google", validateBody(googleLoginSchema), googleLogin);
router.post("/refresh", validateBody(refreshTokenSchema), refresh);
router.post("/logout", validateBody(logoutSchema), logout);
router.get("/me", requireAuth, me);
router.post("/forgot-password", validateBody(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validateBody(resetPasswordSchema), resetPassword);
router.patch("/me/avatar", requireAuth, uploadAvatar.single("avatar"), updateAvatar);
router.patch("/me/profile", requireAuth, validateBody(updateProfileSchema), updateProfile);
router.post("/feedback", requireAuth, feedbackLimit, validateBody(feedbackSchema), sendFeedback);
// #449: delete my account (the auth-server's half; api purges the rest).
router.delete("/me", requireAuth, validateBody(deleteAccountSchema), deleteAccount);

export default router;
