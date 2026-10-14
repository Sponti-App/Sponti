// #449: DELETE /auth/me, the auth-server's half of deleting an account,
// against the real router, validation and error handler. Every model call is
// mocked: no database.
import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcrypt";
import express from "express";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { NotificationSettings, PasswordResetToken, RefreshToken, User } from "#models";
import { createAccessToken } from "#lib/tokens";
import cloudinary from "#lib/cloudinary";

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
        avatarUrl: "https://example.com/a.jpg",
        avatarPublicId: "avatars/sarah",
        bio: "hi",
        instagram: "sarah",
        ...overrides,
    });

const del = async (user: InstanceType<typeof User>, body: unknown) => {
    const res = await fetch(`${baseUrl}/auth/me`, {
        method: "DELETE",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${createAccessToken(user._id.toString())}`,
        },
        body: JSON.stringify(body),
    });
    return { status: res.status, json: res.status === 204 ? null : await res.json() };
};

const mockStores = (user: InstanceType<typeof User>) => {
    mock.method(User, "findById", async () => user);
    const save = mock.method(user, "save", async () => user);
    const tokens = mock.method(RefreshToken, "deleteMany", async () => ({ deletedCount: 2 }));
    const resets = mock.method(PasswordResetToken, "deleteMany", async () => ({ deletedCount: 0 }));
    const settings = mock.method(NotificationSettings, "deleteMany", async () => ({ deletedCount: 1 }));
    const destroy = mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
    return { save, tokens, resets, settings, destroy };
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

describe("DELETE /auth/me", () => {
    it("with the right password: ends sessions, removes the photo, leaves a scrubbed tombstone", async () => {
        const user = makeUser();
        const id = user._id.toString();
        const stores = mockStores(user);

        const { status } = await del(user, { password: PASSWORD });

        assert.equal(status, 204);
        assert.equal(stores.tokens.mock.callCount(), 1);
        assert.equal(stores.resets.mock.callCount(), 1);
        assert.equal(stores.settings.mock.callCount(), 1);
        assert.equal(stores.save.mock.callCount(), 1);
        assert.equal(stores.destroy.mock.calls[0]?.arguments[0], "avatars/sarah");
        assert.ok(user.deletedAt instanceof Date);
        assert.equal(user.username, `deleted-${id}`);
        assert.equal(user.email, `deleted-${id}@deleted.invalid`);
        assert.equal(user.displayName, "deleted user");
        assert.equal(user.passwordHash, null);
        assert.equal(user.avatarUrl, null);
        assert.equal(user.bio, null);
        assert.equal(user.instagram, null);
    });

    it("with a wrong or missing password: 403 and nothing changes", async () => {
        for (const body of [{ password: "wrong-password" }, {}, { confirmUsername: "sarah" }]) {
            const user = makeUser();
            const stores = mockStores(user);

            const { status, json } = await del(user, body);

            assert.equal(status, 403);
            assert.equal(json.message, "that password isn't right");
            assert.equal(stores.save.mock.callCount(), 0);
            assert.equal(stores.tokens.mock.callCount(), 0);
            assert.equal(user.deletedAt, null);
            mock.restoreAll();
        }
    });

    it("a Google-only account confirms with its @username", async () => {
        const user = makeUser({ passwordHash: null, googleId: "google-sub" });
        const stores = mockStores(user);

        const { status } = await del(user, { confirmUsername: "@Sarah" });

        assert.equal(status, 204);
        assert.equal(stores.save.mock.callCount(), 1);
        assert.equal(user.googleId, undefined);
    });

    it("a Google-only account with the wrong @username: 403 and nothing changes", async () => {
        const user = makeUser({ passwordHash: null, googleId: "google-sub" });
        const stores = mockStores(user);

        const { status } = await del(user, { confirmUsername: "someone-else" });

        assert.equal(status, 403);
        assert.equal(stores.save.mock.callCount(), 0);
    });

    it("needs a session", async () => {
        const res = await fetch(`${baseUrl}/auth/me`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password: PASSWORD }),
        });

        assert.equal(res.status, 401);
    });
});
