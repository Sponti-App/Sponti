import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, Circle, NotificationSettings } from "#models";

type JwtPayload = {
    userId: string;
};

const createAccessToken = (userId: string) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured", { cause: { status: 500 } });
    }

    return jwt.sign({ userId }, secret, { expiresIn: "7d" });
};

const getBearerToken = (authorizationHeader?: string) => {
    if (!authorizationHeader?.startsWith("Bearer ")) {
        throw new Error("Missing or invalid authorization header", {
            cause: { status: 401 },
        });
    }

    return authorizationHeader.slice("Bearer ".length);
};

const verifyAccessToken = (token: string) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error("Access token expired", {
                cause: { status: 401, code: "ACCESS_TOKEN_EXPIRED" },
            });
        }

        throw new Error("Invalid access token", { cause: { status: 401 } });
    }
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

    res.status(201).json({
        accessToken,
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

    res.json({
        accessToken,
        user: toUserResponse(user),
    });
};

export const logout = async (_req: Request, res: Response) => {
    res.status(204).send();
};

export const me = async (req: Request, res: Response) => {
    const token = getBearerToken(req.headers.authorization);
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId);

    if (!user) {
        throw new Error("User not found", { cause: { status: 404 } });
    }

    res.json({
        user: toUserResponse(user),
    });
};
