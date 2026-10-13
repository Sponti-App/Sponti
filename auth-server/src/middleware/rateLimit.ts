import type { Request, RequestHandler } from "express";

type RateLimitOptions = {
    /** Length of one counting window. */
    windowMs: number;
    /** Requests allowed per key in one window. */
    max: number;
    /**
     * What a request is counted against. Defaults to the client address.
     * Return null to let a request through uncounted (e.g. no email in the body;
     * validation rejects it next).
     */
    key?: (req: Request) => string | null;
    /** Test seam: the clock, in ms. */
    now?: () => number;
};

// Above this many tracked keys, expired buckets are swept on the next request
// so the map can't grow without bound under a spray of addresses or emails.
const SWEEP_THRESHOLD = 10_000;

export const clientAddress = (req: Request) => req.ip ?? "unknown";

export const bodyEmail = (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
};

/**
 * A small in-memory fixed-window limiter (#535), the same shape as the api's
 * (api/src/middleware/rateLimit.ts) plus a `key` option. It is per process:
 * the auth-server runs as one container behind Caddy, so one counter is the
 * whole picture. `req.ip` is the real client only because app.ts sets
 * `trust proxy` for the one Caddy hop.
 */
export const createRateLimiter = ({
    windowMs,
    max,
    key = clientAddress,
    now = Date.now,
}: RateLimitOptions): RequestHandler => {
    const buckets = new Map<string, { count: number; resetAt: number }>();

    return (req, res, next) => {
        const bucketKey = key(req);
        if (bucketKey === null) return next();

        const current = now();

        if (buckets.size > SWEEP_THRESHOLD) {
            for (const [k, bucket] of buckets) {
                if (bucket.resetAt <= current) buckets.delete(k);
            }
        }

        let bucket = buckets.get(bucketKey);

        if (!bucket || bucket.resetAt <= current) {
            bucket = { count: 0, resetAt: current + windowMs };
            buckets.set(bucketKey, bucket);
        }

        bucket.count += 1;

        if (bucket.count > max) {
            const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - current) / 1000));
            const minutes = Math.ceil(retryAfterSeconds / 60);
            res.setHeader("Retry-After", String(retryAfterSeconds));

            return next(
                new Error(
                    `too many attempts. try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
                    { cause: { status: 429, code: "RATE_LIMITED" } }
                )
            );
        }

        return next();
    };
};

const MINUTE = 60_000;

/**
 * The limits on the public auth routes (#535), keyed by client address unless
 * noted. Generous enough for a group of friends signing in on one wifi, tight
 * enough to stop password guessing and reset-email floods.
 */
export const createAuthRateLimits = () => ({
    login: [
        createRateLimiter({ windowMs: 15 * MINUTE, max: 30 }),
        // Per account too, so guesses spread over many addresses still stop.
        createRateLimiter({ windowMs: 15 * MINUTE, max: 10, key: bodyEmail }),
    ],
    register: [createRateLimiter({ windowMs: 60 * MINUTE, max: 10 })],
    google: [createRateLimiter({ windowMs: 15 * MINUTE, max: 30 })],
    forgotPassword: [
        createRateLimiter({ windowMs: 60 * MINUTE, max: 5 }),
        // One inbox can't be mailed over and over from many addresses.
        createRateLimiter({ windowMs: 60 * MINUTE, max: 3, key: bodyEmail }),
    ],
    resetPassword: [createRateLimiter({ windowMs: 15 * MINUTE, max: 10 })],
    refresh: [createRateLimiter({ windowMs: 15 * MINUTE, max: 120 })],
});
