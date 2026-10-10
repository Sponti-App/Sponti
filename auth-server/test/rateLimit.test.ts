// The auth routes' rate limiter (#535), against a real Express app with the
// real error handler. No database is involved.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type RequestHandler } from "express";
import { createAuthRateLimits, createRateLimiter, errorHandler } from "#middleware";

let server: Server;
let baseUrl: string;
let clock = 0;
const now = () => clock;

const mount = (path: string, limiters: RequestHandler[]) =>
    app.post(path, ...limiters, (_req, res) => {
        res.json({ ok: true });
    });

const app = express();
app.use(express.json());

mount("/by-ip", [createRateLimiter({ windowMs: 60_000, max: 2, now })]);
mount("/by-email", [
    createRateLimiter({
        windowMs: 60_000,
        max: 1,
        now,
        key: (req) => (typeof req.body?.email === "string" ? req.body.email.toLowerCase() : null),
    }),
]);
const realLimits = createAuthRateLimits();
mount("/forgot-password", realLimits.forgotPassword);
app.use(errorHandler);

const post = async (path: string, body: unknown = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    return { status: res.status, retryAfter: res.headers.get("retry-after"), json: await res.json() };
};

before(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

describe("createRateLimiter", () => {
    it("allows max requests per window, then answers 429 with Retry-After and a readable message", async () => {
        clock = 0;
        assert.equal((await post("/by-ip")).status, 200);
        assert.equal((await post("/by-ip")).status, 200);

        const blocked = await post("/by-ip");
        assert.equal(blocked.status, 429);
        assert.equal(blocked.retryAfter, "60");
        assert.equal(blocked.json.message, "too many attempts. try again in 1 minute.");
    });

    it("lets requests through again once the window has passed", async () => {
        clock = 60_000;
        assert.equal((await post("/by-ip")).status, 200);
    });

    it("counts per key, so one email is limited without affecting another", async () => {
        clock = 0;
        assert.equal((await post("/by-email", { email: "Sam@example.com" })).status, 200);
        assert.equal((await post("/by-email", { email: "sam@example.com" })).status, 429);
        assert.equal((await post("/by-email", { email: "kim@example.com" })).status, 200);
    });

    it("lets a request with no key through uncounted", async () => {
        clock = 0;
        assert.equal((await post("/by-email", {})).status, 200);
        assert.equal((await post("/by-email", {})).status, 200);
    });
});

describe("forgot-password limits", () => {
    it("sends at most 3 reset requests for one email in an hour", async () => {
        const body = { email: "someone@example.com" };
        for (let i = 0; i < 3; i += 1) {
            assert.equal((await post("/forgot-password", body)).status, 200);
        }
        const blocked = await post("/forgot-password", body);
        assert.equal(blocked.status, 429);
        assert.match(blocked.json.message, /^too many attempts\. try again in \d+ minutes\.$/);
    });
});
