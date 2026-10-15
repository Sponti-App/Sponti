import type { RequestHandler } from "express";
import { AppError } from "#utils/AppError";

type RateLimitOptions = {
  /** Length of one counting window. */
  windowMs: number;
  /** Requests allowed per client in one window. */
  max: number;
  /** Test seam: the clock, in ms. */
  now?: () => number;
};

// Above this many tracked clients, expired buckets are swept on the next
// request so the map can't grow without bound under a spray of addresses.
const SWEEP_THRESHOLD = 10_000;

type Buckets = Map<string, { count: number; resetAt: number }>;

// Every limiter's counts, so tests can clear them all at once (#455).
const allBuckets = new Set<Buckets>();

/**
 * Test seam (#455): empties every limiter's counts. The counts live in module
 * state, so without this they run across every test in a file and a rate-limit
 * test had to be the last one. Call it in `beforeEach` where public routes are
 * tested. Nothing in the app calls it.
 */
export const resetRateLimits = (): void => {
  for (const buckets of allBuckets) buckets.clear();
};

/**
 * A small in-memory fixed-window limiter, keyed by client address (`req.ip`).
 *
 * Built for the unauthenticated routes (#425). It is per process: the api runs
 * as one container behind Caddy, so one counter is the whole picture. If the
 * api is ever scaled to several instances, move this to a shared store.
 * `req.ip` is the real client only because app.ts sets `trust proxy` for the
 * one Caddy hop in front of the api.
 */
export const createRateLimiter = ({
  windowMs,
  max,
  now = Date.now,
}: RateLimitOptions): RequestHandler => {
  const buckets: Buckets = new Map();
  allBuckets.add(buckets);

  return (req, res, next) => {
    const current = now();

    if (buckets.size > SWEEP_THRESHOLD) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= current) buckets.delete(key);
      }
    }

    const key = req.ip ?? "unknown";
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)))
      );
      return next(new AppError("Too many requests", 429, "RATE_LIMITED"));
    }

    return next();
  };
};
