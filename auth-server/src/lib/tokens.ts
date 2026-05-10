import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";

const getAccessSecret = () => {
    const secret = process.env.ACCESS_JWT_SECRET;

    if (!secret) {
        throw new Error("ACCESS_JWT_SECRET is not configured", { cause: { status: 500 } });
    }

    return secret;
};

const getRefreshSecret = () => {
    const secret = process.env.REFRESH_JWT_SECRET;

    if (!secret) {
        throw new Error("REFRESH_JWT_SECRET is not configured", { cause: { status: 500 } });
    }

    return secret;
};

export const createAccessToken = (userId: string) =>
    jwt.sign({ userId }, getAccessSecret(), { expiresIn: "15m" });

export const createRefreshToken = (userId: string) =>
    jwt.sign({ userId }, getRefreshSecret(), { expiresIn: "7d" });

export const verifyAccessToken = (token: string) =>
    jwt.verify(token, getAccessSecret()) as JwtPayload & { userId: string };

export const verifyRefreshToken = (token: string) =>
    jwt.verify(token, getRefreshSecret()) as JwtPayload & { userId: string };

export const hashRefreshToken = (token: string) => bcrypt.hash(token, 10);
