import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import type { errorHandler as ErrorHandler } from "#middleware/errorHandler";
import type { createRateLimiter as CreateRateLimiter } from "#middleware/rateLimit";

let createRateLimiter: typeof CreateRateLimiter;
let errorHandler: typeof ErrorHandler;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = "mongodb://localhost:27017";
  process.env.DB_NAME = "sponti_api_test";
  process.env.CLIENT_BASE_URL = "http://localhost:3000/";
  process.env.ACCESS_JWT_SECRET = "test-secret";

  ({ createRateLimiter } = await import("#middleware/rateLimit"));
  ({ errorHandler } = await import("#middleware/errorHandler"));
});

const buildApp = (clock: { now: number }, max = 3) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(createRateLimiter({ windowMs: 60_000, max, now: () => clock.now }));
  app.get("/", (_req, res) => {
    res.json({ data: "ok" });
  });
  app.use(errorHandler);
  return app;
};

describe("createRateLimiter", () => {
  it("allows up to max requests per window, then answers 429 with Retry-After", async () => {
    const clock = { now: 1_000_000 };
    const app = buildApp(clock);

    for (let i = 0; i < 3; i += 1) {
      await request(app).get("/").expect(200);
    }
    const limited = await request(app).get("/").expect(429);

    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBe("60");
  });

  it("starts a new window once the old one has passed", async () => {
    const clock = { now: 1_000_000 };
    const app = buildApp(clock, 1);

    await request(app).get("/").expect(200);
    await request(app).get("/").expect(429);
    clock.now += 60_000;
    await request(app).get("/").expect(200);
  });

  it("counts each client address separately (behind one trusted proxy hop)", async () => {
    const clock = { now: 1_000_000 };
    const app = buildApp(clock, 1);

    await request(app).get("/").set("X-Forwarded-For", "203.0.113.1").expect(200);
    await request(app).get("/").set("X-Forwarded-For", "203.0.113.1").expect(429);
    await request(app).get("/").set("X-Forwarded-For", "203.0.113.2").expect(200);
  });
});
