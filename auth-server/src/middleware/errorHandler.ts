import type { ErrorRequestHandler } from "express";

type ErrorPayload = {
    message: string;
};

type ErrorCause = {
    status: number;
    code?: string;
};

const handler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (process.env.NODE_ENV !== "production") {
        console.log(`\x1b[31m${err.stack}\x1b[0m`);
    }

    let statusCode = 500;
    let payload: ErrorPayload = { message: "Internal server error" };

    if (err instanceof Error) {
        payload = { message: err.message };

        if (err.cause && typeof err.cause === "object" && "status" in err.cause) {
            const cause = err.cause as ErrorCause;
            statusCode = cause.status;

            if (cause.code === "ACCESS_TOKEN_EXPIRED") {
                res.setHeader(
                    "WWW-Authenticate",
                    'Bearer error="token_expired", error_description="The access token expired"'
                );
            }
        }
    }

    res.status(statusCode).json(payload);
};

export default handler;