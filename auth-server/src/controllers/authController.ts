import bcrypt from "bcrypt";
import crypto from "crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, Circle, NotificationSettings, PasswordResetToken } from "#models";
import { sendPasswordResetEmail } from "#lib/email";

const createAccessToken = (userId: string) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured", { cause: { status: 500 } });
    }

    return jwt.sign({ userId }, secret, { expiresIn: "7d" });
};

const toUserResponse = (user: InstanceType<typeof User>) => ({
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    avatarPublicId: user.avatarPublicId,
    profileVisibility: user.profileVisibility,
    socialBattery: user.socialBattery,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

const deleteExpiredRefreshTokens = (userId: string) =>
    RefreshToken.deleteMany({
        userId,
        expiresAt: { $lte: new Date() },
    });

const saveRefreshToken = async (userId: string, refreshToken: string) => {
    const tokenHash = await hashRefreshToken(refreshToken);
    const refreshPayload = verifyRefreshToken(refreshToken);
    const expiresAt = refreshPayload.exp
        ? new Date(refreshPayload.exp * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
        userId,
        tokenHash,
        expiresAt,
    });
};

export const register = async (req: Request, res: Response) => {
    const { username, displayName, email, password } = req.body;

    const normalizedEmail = email.toLowerCase();
    const userExists = await User.exists({ email: normalizedEmail });

    if (userExists) {
        throw new Error("User with this email already exists", { cause: { status: 409 } });
    }

    const usernameExists = await User.exists({ username });

    if (usernameExists) {
        throw new Error("Username already taken", { cause: { status: 409 } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
        username,
        displayName,
        email: normalizedEmail,
        passwordHash,
    });
    await Circle.create([
        {
            ownerId: user._id,
            name: "Close Friends",
            color: "#00FF00", // Green
        },
        {
            ownerId: user._id,
            name: "All Friends",
            color: "#FF0000",// Red
        },
    ]);
    await NotificationSettings.create({
        userId: user._id,
    });

    const accessToken = createAccessToken(user._id.toString());
    const refreshToken = createRefreshToken(user._id.toString());
    await saveRefreshToken(user._id.toString(), refreshToken);

    res.status(201).json({
        accessToken,
        refreshToken,
        user: toUserResponse(user),
    });
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        throw new Error("Invalid email or password", { cause: { status: 401 } });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
        throw new Error("Invalid email or password", { cause: { status: 401 } });
    }

    const accessToken = createAccessToken(user._id.toString());
    const refreshToken = createRefreshToken(user._id.toString());
    await deleteExpiredRefreshTokens(user._id.toString());
    await saveRefreshToken(user._id.toString(), refreshToken);

    res.json({
        accessToken,
        refreshToken,
        user: toUserResponse(user),
    });
};

export const refresh = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    let refreshPayload: ReturnType<typeof verifyRefreshToken>;

    try {
        refreshPayload = verifyRefreshToken(refreshToken);
    } catch {
        throw new Error("Invalid refresh token", { cause: { status: 401 } });
    }

    const activeTokens = await RefreshToken.find({
        userId: refreshPayload.userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    let matchedToken: InstanceType<typeof RefreshToken> | null = null;

    for (const tokenDoc of activeTokens) {
        const matches = await bcrypt.compare(refreshToken, tokenDoc.tokenHash);

        if (matches) {
            matchedToken = tokenDoc;
            break;
        }
    }

    if (!matchedToken) {
        throw new Error("Invalid refresh token", { cause: { status: 401 } });
    }

    const consumedToken = await RefreshToken.findOneAndDelete(
        {
            _id: matchedToken._id,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
        }
    );

    if (!consumedToken) {
        throw new Error("Invalid refresh token", { cause: { status: 401 } });
    }

    const accessToken = createAccessToken(refreshPayload.userId);
    const nextRefreshToken = createRefreshToken(refreshPayload.userId);
    await deleteExpiredRefreshTokens(refreshPayload.userId);
    await saveRefreshToken(refreshPayload.userId, nextRefreshToken);

    res.json({
        accessToken,
        refreshToken: nextRefreshToken,
    });
};

export const logout = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    let refreshPayload: ReturnType<typeof verifyRefreshToken>;

    try {
        refreshPayload = verifyRefreshToken(refreshToken);
    } catch {
        throw new Error("Invalid refresh token", { cause: { status: 401 } });
    }

    const activeTokens = await RefreshToken.find({
        userId: refreshPayload.userId,
        revokedAt: null,
    }).sort({ createdAt: -1 });

    let matchedToken: InstanceType<typeof RefreshToken> | null = null;

    for (const tokenDoc of activeTokens) {
        const matches = await bcrypt.compare(refreshToken, tokenDoc.tokenHash);

        if (matches) {
            matchedToken = tokenDoc;
            break;
        }
    }

    if (matchedToken) await matchedToken.deleteOne();

    res.json({ success: true });
};

export const me = async (req: Request, res: Response) => {
    const user = await User.findById(req.userId);

    if (!user) {
        throw new Error("User not found", { cause: { status: 404 } });
    }

    res.json({
        user: toUserResponse(user),
    });
};

export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };
    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    // Always respond 200 to avoid leaking whether an account exists
    if (!user) {
        res.json({ message: "If that email is registered you will receive a reset link shortly." });
        return;
    }

    // Invalidate any existing unused tokens for this user
    await PasswordResetToken.updateMany(
        { userId: user._id, used: false },
        { used: true }
    );

    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${plainToken}`;

    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    res.json({ message: "If that email is registered you will receive a reset link shortly." });
};

export const resetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body as { token: string; password: string };

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await PasswordResetToken.findOne({ tokenHash, used: false });

    if (!record || record.expiresAt < new Date()) {
        throw new Error("Reset link is invalid or has expired", { cause: { status: 400 } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(record.userId, { passwordHash });
    await PasswordResetToken.findByIdAndUpdate(record._id, { used: true });

    res.json({ message: "Password updated successfully." });
};
