// POST /auth/reset-password (#536) against the real router, validation and
// error handler. Every model call is mocked: no database.
import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { PasswordResetToken, RefreshToken, User } from "#models";

let server: Server;
let baseUrl: string;

const reset = async (body: unknown) => {
    const res = await fetch(`${baseUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
};

before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

afterEach(() => mock.restoreAll());

describe("POST /auth/reset-password", () => {
    const userId = new mongoose.Types.ObjectId();
    const token = "a".repeat(64);

    it("uses the token up atomically, sets the password and ends every session", async () => {
        const consume = mock.method(PasswordResetToken, "findOneAndUpdate", async () => ({
            _id: new mongoose.Types.ObjectId(),
            userId,
        }));
        const setPassword = mock.method(User, "findByIdAndUpdate", async () => ({}));
        const endSessions = mock.method(RefreshToken, "deleteMany", async () => ({ deletedCount: 2 }));

        const { status } = await reset({ token, password: "a-new-password" });

        assert.equal(status, 200);

        const [filter, update] = consume.mock.calls[0]!.arguments as [Record<string, unknown>, unknown];
        assert.equal(filter.tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
        assert.equal(filter.used, false);
        assert.ok((filter.expiresAt as { $gt: Date }).$gt instanceof Date);
        assert.deepEqual(update, { used: true });

        assert.equal(String(setPassword.mock.calls[0]!.arguments[0]), String(userId));
        assert.deepEqual(endSessions.mock.calls[0]!.arguments[0], { userId });
    });

    it("rejects a used, expired or unknown token without touching the password or sessions", async () => {
        mock.method(PasswordResetToken, "findOneAndUpdate", async () => null);
        const setPassword = mock.method(User, "findByIdAndUpdate", async () => ({}));
        const endSessions = mock.method(RefreshToken, "deleteMany", async () => ({ deletedCount: 0 }));

        const { status, json } = await reset({ token, password: "a-new-password" });

        assert.equal(status, 400);
        assert.equal(json.message, "Reset link is invalid or has expired");
        assert.equal(setPassword.mock.callCount(), 0);
        assert.equal(endSessions.mock.callCount(), 0);
    });
});
