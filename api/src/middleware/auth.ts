import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "#config/env";
import { AppError } from "#utils/AppError";

type AccessTokenClaims = JwtPayload & {
  userId?: unknown;
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.user) return next();

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Missing Bearer access token", 401, "ACCESS_TOKEN_MISSING"));
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return next(new AppError("Missing Bearer access token", 401, "ACCESS_TOKEN_MISSING"));
  }

  try {
    const decoded = jwt.verify(token, env.ACCESS_JWT_SECRET);

    if (typeof decoded === "string") {
      return next(new AppError("Invalid access token payload", 401, "ACCESS_TOKEN_INVALID"));
    }

    const claims = decoded as AccessTokenClaims;
    // Compatibility bridge: auth-server currently signs { userId }. Prefer JWT sub long-term.
    const candidateUserId =
      typeof claims.sub === "string"
        ? claims.sub
        : typeof claims.userId === "string"
          ? claims.userId
          : undefined;

    if (!candidateUserId || !Types.ObjectId.isValid(candidateUserId)) {
      return next(new AppError("Invalid access token subject", 401, "ACCESS_TOKEN_INVALID"));
    }

    req.user = {
      id: candidateUserId,
      claims,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError("Access token expired", 401, "ACCESS_TOKEN_EXPIRED"));
    }

    return next(new AppError("Invalid access token", 401, "ACCESS_TOKEN_INVALID"));
  }
};
