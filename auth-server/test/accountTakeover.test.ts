// The two account-takeover paths closed in #537, against the real router,
// validation and error handler. Every model call is mocked: no database.
import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcrypt";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { RefreshToken, User } from "#models";
import { createAccessToken } from "#lib/tokens";

const PASSWORD = "correct-horse-battery";

let server: Server;
let baseUrl: string;
let passwordHash: string;

const makeUser = (overrides: Record<string, unknown> = {}) =>
    new User({
        username: "sarah",
        displayName: "Sarah",
        email: "sarah@example.com",
        passwordHash,
        ...overrides,
    });

const request = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
};

before(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);

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

describe("POST /auth/google linking to an existing account", () => {
    const signInWithGoogle = (user: InstanceType<typeof User>) => {
        mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({
            getPayload: () => ({ sub: "google-sub", email: "sarah@example.com", email_verified: true }),
        }));
        mock.method(User, "findOne", async () => user);
        const save = mock.method(user, "save", async () => user);
        const deleteMany = mock.method(RefreshToken, "deleteMany", async () => ({ deletedCount: 0 }));
        mock.method(RefreshToken, "create", async () => ({}));
        return { save, deleteMany, response: request("POST", "/auth/google", { credential: "id-token" }) };
    };

    it("drops an unproven password and ends every earlier session on the first link", async () => {
        const user = makeUser();
        const { save, deleteMany, response } = signInWithGoogle(user);

        const { status } = await response;

        assert.equal(status, 200);
        assert.equal(user.passwordHash, null);
        assert.equal(user.googleId, "google-sub");
        assert.equal(save.mock.callCount(), 1);
        // The first call ends every session; later calls only sweep expired ones.
        assert.deepEqual(deleteMany.mock.calls[0]!.arguments[0], { userId: user._id });
    });

    it("leaves an already linked account's password and sessions alone", async () => {
        const user = makeUser({ googleId: "google-sub" });
        const { deleteMany, response } = signInWithGoogle(user);

        const { status } = await response;

        assert.equal(status, 200);
        assert.equal(user.passwordHash, passwordHash);
        for (const call of deleteMany.mock.calls) {
            assert.ok("expiresAt" in (call.arguments[0] as object), "only expired sessions are swept");
        }
    });
});

describe("PATCH /auth/me/profile changing the email", () => {
    const patch = (body: unknown, user = makeUser()) => {
        mock.method(User, "findById", async () => user);
        mock.method(User, "exists", async () => null);
        const save = mock.method(user, "save", async () => user);
        return { user, save, response: request("PATCH", "/auth/me/profile", body, createAccessToken(user._id.toString())) };
    };

    it("changes the email with the right current password", async () => {
        const { user, save, response } = patch({ email: "new@example.com", currentPassword: PASSWORD });

        const { status, json } = await response;

        assert.equal(status, 200);
        assert.equal(user.email, "new@example.com");
        assert.equal(json.user.email, "new@example.com");
        assert.equal(save.mock.callCount(), 1);
    });

    it("refuses with 403 when the current password is missing or wrong", async () => {
        for (const body of [
            { email: "new@example.com" },
            { email: "new@example.com", currentPassword: "not-the-password" },
        ]) {
            const { user, save, response } = patch(body);
            const { status, json } = await response;

            assert.equal(status, 403);
            assert.equal(json.message, "current password is incorrect");
            assert.equal(user.email, "sarah@example.com");
            assert.equal(save.mock.callCount(), 0);
            mock.restoreAll();
        }
    });

    it("asks an account without a password to set one first", async () => {
        const { save, response } = patch(
            { email: "new@example.com", currentPassword: "anything" },
            makeUser({ passwordHash: null, googleId: "google-sub" })
        );

        const { status, json } = await response;

        assert.equal(status, 403);
        assert.match(json.message, /^set a password first/);
        assert.equal(save.mock.callCount(), 0);
    });

    it("needs no password when the email is sent unchanged", async () => {
        const { save, response } = patch({ email: "Sarah@example.com", displayName: "Sarah K" });

        const { status } = await response;

        assert.equal(status, 200);
        assert.equal(save.mock.callCount(), 1);
    });
});
