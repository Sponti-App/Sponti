// #542: a suspended account can't sign in, by password or Google, against the
// real router, validation and error handler. Every model call is mocked: no
// database.
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
        googleId: "google-sub",
        ...overrides,
    });

const post = async (path: string, body: unknown) => {
    const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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

const mockSessionStore = () => {
    mock.method(RefreshToken, "deleteMany", async () => ({ deletedCount: 0 }));
    return mock.method(RefreshToken, "create", async () => ({}));
};

describe("suspended accounts", () => {
    it("refuse a password sign-in and issue no session", async () => {
        mock.method(User, "findOne", async () => makeUser({ suspendedAt: new Date() }));
        const create = mockSessionStore();

        const { status, json } = await post("/auth/login", {
            email: "sarah@example.com",
            password: PASSWORD,
        });

        assert.equal(status, 403);
        assert.match(json.message, /suspended/);
        assert.equal(create.mock.callCount(), 0);
    });

    it("refuse a Google sign-in and issue no session", async () => {
        mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({
            getPayload: () => ({
                sub: "google-sub",
                email: "sarah@example.com",
                email_verified: true,
            }),
        }));
        const user = makeUser({ suspendedAt: new Date() });
        mock.method(User, "findOne", async () => user);
        mock.method(user, "save", async () => user);
        const create = mockSessionStore();

        const { status } = await post("/auth/google", { credential: "id-token" });

        assert.equal(status, 403);
        assert.equal(create.mock.callCount(), 0);
    });

    it("leave a normal account signing in as before", async () => {
        mock.method(User, "findOne", async () => makeUser());
        const create = mockSessionStore();

        const { status, json } = await post("/auth/login", {
            email: "sarah@example.com",
            password: PASSWORD,
        });

        assert.equal(status, 200);
        assert.ok(json.accessToken);
        assert.equal(create.mock.callCount(), 1);
    });
});
