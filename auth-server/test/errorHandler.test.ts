// What the error handler tells a client (#544). Errors the code raised on
// purpose keep their message and status; everything else is a generic 500
// and the detail stays in the server log.
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { User } from "#models";
import { createAccessToken } from "#lib/tokens";

let server: Server;
let baseUrl: string;

before(async () => {
    const app = express();
    app.use(express.json({ limit: "1kb" }));
    app.get("/boom/driver", () => {
        throw new Error('E11000 duplicate key error collection: sponti.users index: email_1 dup key: { email: "a@b.c" }');
    });
    app.get("/boom/string", () => {
        throw "plain string failure";
    });
    app.get("/boom/deliberate", () => {
        throw new Error("Custom client message", { cause: { status: 409 } });
    });
    app.get("/boom/deliberate-500", () => {
        throw new Error("secret detail", { cause: { status: 503 } });
    });
    app.post("/echo", (req, res) => {
        res.json(req.body);
    });
    app.use("/auth", authRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

// The handler logs unexpected errors; keep the test output readable.
beforeEach(() => {
    mock.method(console, "error", () => {});
    mock.method(console, "log", () => {});
});

afterEach(() => mock.restoreAll());

const get = async (path: string, token?: string) => {
    const res = await fetch(`${baseUrl}${path}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text();
    return { status: res.status, text, json: JSON.parse(text) };
};

describe("errorHandler", () => {
    it("keeps the message and status of errors raised on purpose", async () => {
        const { status, json } = await get("/boom/deliberate");
        assert.equal(status, 409);
        assert.deepEqual(json, { message: "Custom client message" });
    });

    it("keeps a 5xx raised on purpose and logs it", async () => {
        const logged = mock.method(console, "error", () => {});
        const { status, json } = await get("/boom/deliberate-500");
        assert.equal(status, 503);
        assert.deepEqual(json, { message: "secret detail" });
        assert.equal(logged.mock.callCount(), 1);
    });

    it("answers any other error with a generic 500 and logs the detail", async () => {
        const logged = mock.method(console, "error", () => {});
        const { status, text } = await get("/boom/driver");
        assert.equal(status, 500);
        assert.deepEqual(JSON.parse(text), { message: "Internal server error" });
        assert.ok(!text.includes("E11000"));
        assert.ok(!text.includes("email_1"));
        assert.equal(logged.mock.callCount(), 1);
    });

    it("does not leak a thrown non-Error", async () => {
        const { status, text } = await get("/boom/string");
        assert.equal(status, 500);
        assert.ok(!text.includes("plain string failure"));
    });

    it("answers malformed JSON with 400 in our own words", async () => {
        const res = await fetch(`${baseUrl}/echo`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: '{"a": ',
        });
        const text = await res.text();
        assert.equal(res.status, 400);
        assert.deepEqual(JSON.parse(text), { message: "Invalid request" });
    });

    it("answers an oversized body with 413", async () => {
        const res = await fetch(`${baseUrl}/echo`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ filler: "x".repeat(5000) }),
        });
        assert.equal(res.status, 413);
        assert.deepEqual(await res.json(), { message: "Request body too large" });
    });

    it("still answers an unknown route with 404", async () => {
        const { status, json } = await get("/nope");
        assert.equal(status, 404);
        assert.deepEqual(json, { message: "Not Found" });
    });
});

describe("requireAuth", () => {
    it("answers a malformed token with 401, not 500", async () => {
        const { status, json } = await get("/auth/me", "not-a-jwt");
        assert.equal(status, 401);
        assert.deepEqual(json, { message: "Invalid access token" });
    });

    it("answers a token signed with another secret with 401 and no jwt detail", async () => {
        const forged = jwt.sign({ userId: "507f1f77bcf86cd799439011" }, "some-other-secret");
        const { status, text } = await get("/auth/me", forged);
        assert.equal(status, 401);
        assert.ok(!text.includes("signature"));
    });

    it("still tells an expired token apart", async () => {
        const expired = jwt.sign({ userId: "507f1f77bcf86cd799439011" }, "test-access-secret", {
            expiresIn: -10,
        });
        const res = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${expired}` } });
        assert.equal(res.status, 401);
        assert.match(res.headers.get("www-authenticate") ?? "", /token_expired/);
    });

    it("lets a valid token through", async () => {
        mock.method(User, "findById", async () => null);
        const { status, json } = await get("/auth/me", createAccessToken("507f1f77bcf86cd799439011"));
        assert.equal(status, 404);
        assert.deepEqual(json, { message: "User not found" });
    });
});
