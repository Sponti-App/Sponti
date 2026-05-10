import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { User, Circle, NotificationSettings, RefreshToken } from "#models";
import {
    createAccessToken,
    createRefreshToken,
    hashRefreshToken,
    verifyRefreshToken,
} from "#lib";

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
    const tokenHash = await hashRefreshToken(refreshToken);
    const refreshPayload = verifyRefreshToken(refreshToken);
    const expiresAt = refreshPayload.exp
        ? new Date(refreshPayload.exp * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
        userId: user._id,
        tokenHash,
        expiresAt,
    });

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
    const tokenHash = await hashRefreshToken(refreshToken);
    const refreshPayload = verifyRefreshToken(refreshToken);
    const expiresAt = refreshPayload.exp
        ? new Date(refreshPayload.exp * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
        userId: user._id,
        tokenHash,
        expiresAt,
    });

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

    matchedToken.revokedAt = new Date();
    await matchedToken.save();

    const accessToken = createAccessToken(refreshPayload.userId);
    const nextRefreshToken = createRefreshToken(refreshPayload.userId);
    const tokenHash = await hashRefreshToken(nextRefreshToken);
    const nextRefreshPayload = verifyRefreshToken(nextRefreshToken);
    const expiresAt = nextRefreshPayload.exp
        ? new Date(nextRefreshPayload.exp * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
        userId: refreshPayload.userId,
        tokenHash,
        expiresAt,
    });

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

    if (matchedToken) {
        matchedToken.revokedAt = new Date();
        await matchedToken.save();
    }

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
