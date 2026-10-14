import type { ErrorRequestHandler } from "express";
import { env } from "#config/env";

type ErrorPayload = {
    message: string;
};

type ErrorCause = {
    status: number;
    code?: string;
};

const isErrorCause = (cause: unknown): cause is ErrorCause =>
    typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    typeof cause.status === "number";

// Body-parser (malformed JSON, oversized body) raises http-errors with a
// `status` and `expose: true`, not our `cause`. They are safe to answer, but
// with our own wording rather than the parser's.
const clientErrorMessages: Record<number, string> = {
    400: "Invalid request",
    413: "Request body too large",
    415: "Unsupported content type",
};

const clientErrorStatus = (err: unknown): number | undefined => {
    if (typeof err !== "object" || err === null) return undefined;
    const { status, expose } = err as { status?: unknown; expose?: unknown };
    return expose === true && typeof status === "number" && status >= 400 && status < 500
        ? status
        : undefined;
};

const handler: ErrorRequestHandler = (err, _req, res, _next) => {
    // Only errors the code raised on purpose (a `cause.status`) may tell the
    // client what went wrong. Anything else (a driver, jsonwebtoken, a bug)
    // can carry index names, values or internals, so it stays in the log.
    if (err instanceof Error && isErrorCause(err.cause)) {
        const cause = err.cause;

        if (cause.status >= 500) {
            console.error(err.stack);
        } else if (env.NODE_ENV !== "production") {
            console.log(`\x1b[31m${err.stack}\x1b[0m`);
        }

        if (cause.code === "ACCESS_TOKEN_EXPIRED") {
            res.setHeader(
                "WWW-Authenticate",
                'Bearer error="token_expired", error_description="The access token expired"'
            );
        }

        const payload: ErrorPayload = { message: err.message };
        res.status(cause.status).json(payload);
        return;
    }

    const clientStatus = clientErrorStatus(err);
    if (clientStatus !== undefined) {
        const payload: ErrorPayload = {
            message: clientErrorMessages[clientStatus] ?? "Invalid request",
        };
        res.status(clientStatus).json(payload);
        return;
    }

    console.error(err instanceof Error ? err.stack : err);
    const payload: ErrorPayload = { message: "Internal server error" };
    res.status(500).json(payload);
};

export default handler;
