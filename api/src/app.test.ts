import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = "mongodb://localhost:27017";
  process.env.DB_NAME = "sponti_api_test";
  process.env.PORT = "4001";
  process.env.CLIENT_BASE_URL = "http://localhost:3000";
  process.env.ACCESS_JWT_SECRET = "test-secret";

  const module = await import("#app");
  app = module.createApp();
});

describe("app", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({
      data: {
        status: "ok",
        service: "sponti-api",
      },
    });
  });

  it("requires auth for API routes", async () => {
    const response = await request(app).get("/api/v1/events").expect(401);

    expect(response.body.error.code).toBe("ACCESS_TOKEN_MISSING");
  });
});
