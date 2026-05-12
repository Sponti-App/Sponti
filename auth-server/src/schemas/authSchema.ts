import { z } from "zod";

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

export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
});

export const updateProfileSchema = z.object({
    displayName: z.string().min(2).max(50).optional(),
    avatarUrl: z.string().url().optional(),
    avatarPublicId: z.string().optional(),
    profileVisibility: z.enum(["public", "private"]).optional(),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
    refreshToken: z.string().min(1),
});
