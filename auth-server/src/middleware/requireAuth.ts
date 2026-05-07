import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

type JwtPayload = {
    userId: string;
};

declare module "express-serve-static-core" {
    interface Request {
        userId?: string;
    }
}

const requireAuth: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
        return next(
            new Error("Missing or invalid authorization header", {
                cause: { status: 401 },
            })
        );
    }

    const token = header.slice("Bearer ".length);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        return next(
            new Error("JWT_SECRET is not configured", { cause: { status: 500 } })
        );
    }

    try {
        const payload = jwt.verify(token, secret) as JwtPayload;
        req.userId = payload.userId;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return next(
                new Error("Access token expired", {
                    cause: { status: 401, code: "ACCESS_TOKEN_EXPIRED" },
                })
            );
        }

        return next(
            new Error("Invalid access token", { cause: { status: 401 } })
        );
    }
};

export default requireAuth;
