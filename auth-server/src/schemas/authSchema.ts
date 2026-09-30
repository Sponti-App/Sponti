import { z } from "zod";
import { normalizeBio, normalizeInstagram, normalizeTelegram, type ProfileFieldResult } from "#lib/profileFields";

type Normalizer = (raw: string | null) => ProfileFieldResult;

// A self-authored profile field: a string (normalised) or null / "" to clear it.
const profileField = (normalize: Normalizer) =>
    z.union([z.string(), z.null()]).transform((raw, ctx) => {
        const result = normalize(raw);

        if (!result.ok) {
            ctx.addIssue({ code: "custom", message: result.message });
            return z.NEVER;
        }

        return result.value;
    });

export const registerSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores and hyphens"),
    displayName: z.string().min(2).max(50),
    email: z.string().email(),
    password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
});

export const googleLoginSchema = z.object({
    credential: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
});

export const updateProfileSchema = z.object({
    displayName: z.string().min(2).max(50).optional(),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores and hyphens").optional(),
    email: z.string().email().optional(),
    profileVisibility: z.enum(["public", "private"]).optional(),
    bio: profileField(normalizeBio).optional(),
    instagram: profileField(normalizeInstagram).optional(),
    telegram: profileField(normalizeTelegram).optional(),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
    refreshToken: z.string().min(1),
});
