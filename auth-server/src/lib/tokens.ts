import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "#config/env";

export const createAccessToken = (userId: string) =>
    jwt.sign({ userId }, env.ACCESS_JWT_SECRET, { expiresIn: "15m" });

export const createRefreshToken = (userId: string) =>
    jwt.sign({ userId }, env.REFRESH_JWT_SECRET, { expiresIn: "7d", jwtid: randomUUID() });

export const verifyAccessToken = (token: string) =>
    jwt.verify(token, env.ACCESS_JWT_SECRET) as JwtPayload & { userId: string };

export const verifyRefreshToken = (token: string) =>
    jwt.verify(token, env.REFRESH_JWT_SECRET) as JwtPayload & { userId: string };

export const hashRefreshToken = (token: string) => bcrypt.hash(token, 10);
