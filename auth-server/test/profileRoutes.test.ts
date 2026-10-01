// HTTP-level tests for the profile fields (#287) against the real router,
// validation and error handler. Every model call is mocked: no database.
import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { NotificationSettings, RefreshToken, User } from "#models";
import { createAccessToken } from "#lib/tokens";

const PASSWORD = "correct-horse-battery";
const PROFILE = { bio: "climbing and coffee", instagram: "sarah.kim", telegram: "sarahkim" };
const PROFILE_KEYS = Object.keys(PROFILE);

let server: Server;
let baseUrl: string;
let passwordHash: string;

const makeUser = (overrides: Record<string, unknown> = {}) =>
    new User({
        username: "sarah",
        displayName: "Sarah",
        email: "sarah@example.com",
        passwordHash,
        ...PROFILE,
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
    const text = await res.text();
    return { status: res.status, text, json: JSON.parse(text) };
};

// Session writes performed by login/register/Google sign-in.
const mockSessionStore = () => {
    mock.method(RefreshToken, "deleteMany", async () => ({ deletedCount: 0 }));
    mock.method(RefreshToken, "create", async () => ({}));
};

const assertNoProfileFields = (text: string) => {
    for (const key of PROFILE_KEYS) {
        assert.ok(!text.includes(`"${key}"`), `response must not carry "${key}": ${text}`);
    }
    for (const value of Object.values(PROFILE)) {
        assert.ok(!text.includes(value), `response must not carry "${value}": ${text}`);
    }
};

before(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);

    const app = express();
    app.use(express.json());
    app.use("/auth", authRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Bind to the same loopback address the requests use, so a request can
    // never reach some other local process listening on the same port number.
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

afterEach(() => mock.restoreAll());

describe("PATCH /auth/me/profile", () => {
    const patch = (body: unknown, user = makeUser({ bio: null, instagram: null, telegram: null })) => {
        mock.method(User, "findById", async () => user);
        const save = mock.method(user, "save", async () => user);
        return { user, save, response: request("PATCH", "/auth/me/profile", body, createAccessToken(user._id.toString())) };
    };

    it("stores normalised handles from @handle and pasted links, and returns them", async () => {
        const { user, save, response } = patch({
            bio: "  climbing and coffee  ",
            instagram: "https://www.instagram.com/Sarah.Kim/?igsh=xyz",
            telegram: "@SarahKim",
        });
        const { status, json } = await response;

        assert.equal(status, 200);
        assert.equal(save.mock.callCount(), 1);
        assert.equal(user.bio, "climbing and coffee");
        assert.equal(user.instagram, "sarah.kim");
        assert.equal(user.telegram, "sarahkim");
        assert.deepEqual(
            { bio: json.user.bio, instagram: json.user.instagram, telegram: json.user.telegram },
            PROFILE,
        );
    });

    it("accepts t.me and instagram.com links without a scheme", async () => {
        const { user, response } = patch({ instagram: "instagram.com/sarah.kim", telegram: "t.me/sarahkim" });
        assert.equal((await response).status, 200);
        assert.equal(user.instagram, "sarah.kim");
        assert.equal(user.telegram, "sarahkim");
    });

    it("clears fields sent as null or empty string", async () => {
        const { user, response } = patch({ bio: "", instagram: null, telegram: "  " }, makeUser());
        const { status, json } = await response;

        assert.equal(status, 200);
        assert.equal(user.bio, null);
        assert.equal(user.instagram, null);
        assert.equal(user.telegram, null);
        assert.equal(json.user.bio, null);
        assert.equal(json.user.instagram, null);
        assert.equal(json.user.telegram, null);
    });

    it("leaves fields that are not sent untouched", async () => {
        const { user, response } = patch({ displayName: "Sarah K" }, makeUser());
        assert.equal((await response).status, 200);
        assert.equal(user.displayName, "Sarah K");
        assert.equal(user.bio, PROFILE.bio);
        assert.equal(user.instagram, PROFILE.instagram);
        assert.equal(user.telegram, PROFILE.telegram);
    });

    it("accepts an 80-character bio and rejects 81 with a 400", async () => {
        const accepted = patch({ bio: "x".repeat(80) });
        assert.equal((await accepted.response).status, 200);
        assert.equal(accepted.user.bio, "x".repeat(80));
        mock.restoreAll();

        const rejected = patch({ bio: "x".repeat(81) });
        const { status, json } = await rejected.response;
        assert.equal(status, 400);
        assert.match(json.message, /Bio must be 80 characters or fewer/);
        assert.match(json.message, /bio/);
        assert.equal(rejected.save.mock.callCount(), 0);
    });

    it("rejects an invalid Instagram handle with a clear 400", async () => {
        const { save, response } = patch({ instagram: "sarah..kim" });
        const { status, json } = await response;
        assert.equal(status, 400);
        assert.match(json.message, /Instagram handle must be/);
        assert.match(json.message, /instagram/);
        assert.equal(save.mock.callCount(), 0);
    });

    it("rejects an invalid Telegram handle with a clear 400", async () => {
        const { save, response } = patch({ telegram: "abc" });
        const { status, json } = await response;
        assert.equal(status, 400);
        assert.match(json.message, /Telegram handle must be 5–32/);
        assert.equal(save.mock.callCount(), 0);
    });

    it("rejects a link to the wrong site", async () => {
        const { status, json } = await patch({ telegram: "https://instagram.com/sarahkim" }).response;
        assert.equal(status, 400);
        assert.match(json.message, /Telegram must be a handle or a t\.me profile link/);
    });

    it("rejects non-string values", async () => {
        const { status } = await patch({ instagram: 42 }).response;
        assert.equal(status, 400);
    });
});

describe("GET /auth/me", () => {
    it("returns the user's own bio and handles", async () => {
        const user = makeUser();
        mock.method(User, "findById", async () => user);

        const { status, json } = await request("GET", "/auth/me", undefined, createAccessToken(user._id.toString()));
        assert.equal(status, 200);
        assert.equal(json.user.bio, PROFILE.bio);
        assert.equal(json.user.instagram, PROFILE.instagram);
        assert.equal(json.user.telegram, PROFILE.telegram);
    });

    it("returns null for a user who never set them", async () => {
        const user = makeUser({ bio: undefined, instagram: undefined, telegram: undefined });
        mock.method(User, "findById", async () => user);

        const { json } = await request("GET", "/auth/me", undefined, createAccessToken(user._id.toString()));
        assert.equal(json.user.bio, null);
        assert.equal(json.user.instagram, null);
        assert.equal(json.user.telegram, null);
    });
});

describe("the profile fields do not leak into any other response", () => {
    it("login response", async () => {
        mock.method(User, "findOne", async () => makeUser());
        mockSessionStore();

        const { status, text } = await request("POST", "/auth/login", { email: "sarah@example.com", password: PASSWORD });
        assert.equal(status, 200);
        assertNoProfileFields(text);
    });

    it("register response", async () => {
        mock.method(User, "exists", async () => null);
        mock.method(User, "create", async () => makeUser());
        mock.method(NotificationSettings, "create", async () => ({}));
        mockSessionStore();

        const { status, text } = await request("POST", "/auth/register", {
            username: "sarah",
            displayName: "Sarah",
            email: "sarah@example.com",
            password: PASSWORD,
        });
        assert.equal(status, 201);
        assertNoProfileFields(text);
    });

    it("Google sign-in response", async () => {
        const user = makeUser({ googleId: "google-sub" });
        mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({
            getPayload: () => ({ sub: "google-sub", email: "sarah@example.com", email_verified: true }),
        }));
        mock.method(User, "findOne", async () => user);
        mock.method(user, "save", async () => user);
        mockSessionStore();

        const { status, text } = await request("POST", "/auth/google", { credential: "id-token" });
        assert.equal(status, 200);
        assertNoProfileFields(text);
    });

    it("access and refresh tokens carry only the user id", async () => {
        mock.method(User, "findOne", async () => makeUser());
        mockSessionStore();

        const { json } = await request("POST", "/auth/login", { email: "sarah@example.com", password: PASSWORD });
        for (const token of [json.accessToken, json.refreshToken]) {
            const claims = jwt.decode(token) as Record<string, unknown>;
            assert.deepEqual(
                Object.keys(claims).filter((k) => !["iat", "exp", "jti"].includes(k)),
                ["userId"],
            );
        }
    });

    it("validation errors do not echo the submitted values", async () => {
        const user = makeUser();
        mock.method(User, "findById", async () => user);

        const { text } = await request(
            "PATCH",
            "/auth/me/profile",
            { instagram: "not a handle!!" },
            createAccessToken(user._id.toString()),
        );
        assert.ok(!text.includes("not a handle!!"));
    });
});
