// PATCH /auth/me/avatar (#539) against the real router, upload middleware
// and error handler. Cloudinary and every model call are mocked.
import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Writable } from "node:stream";
import express from "express";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { User } from "#models";
import { createAccessToken } from "#lib/tokens";
import cloudinary from "#lib/cloudinary";

let server: Server;
let baseUrl: string;

type UploadCallback = (error?: unknown, result?: { secure_url: string; public_id: string }) => void;

// Stands in for Cloudinary's upload stream: swallows the bytes, then answers.
const mockUpload = (answer: (callback: UploadCallback) => void) =>
    mock.method(cloudinary.uploader, "upload_stream", (_options: unknown, callback: UploadCallback) =>
        new Writable({
            write(_chunk, _encoding, done) {
                done();
            },
            final(done) {
                answer(callback);
                done();
            },
        })
    );

const upload = async (type: string, user: InstanceType<typeof User>) => {
    const form = new FormData();
    form.append("avatar", new Blob([new Uint8Array([1, 2, 3])], { type }), "photo");
    const res = await fetch(`${baseUrl}/auth/me/avatar`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${createAccessToken(user._id.toString())}` },
        body: form,
    });
    return { status: res.status, json: await res.json() };
};

const makeUser = (overrides: Record<string, unknown> = {}) =>
    new User({ username: "sarah", displayName: "Sarah", email: "sarah@example.com", ...overrides });

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

describe("PATCH /auth/me/avatar", () => {
    it("answers 500 when Cloudinary fails, and the server keeps serving", async () => {
        const user = makeUser();
        mock.method(User, "findById", async () => user);
        const save = mock.method(user, "save", async () => user);
        mockUpload((callback) => callback(new Error("cloudinary is down")));

        const failed = await upload("image/png", user);

        assert.equal(failed.status, 500);
        assert.equal(failed.json.message, "Failed to upload avatar");
        assert.equal(save.mock.callCount(), 0);

        mock.restoreAll();
        mock.method(User, "findById", async () => user);
        mock.method(user, "save", async () => user);
        mockUpload((callback) => callback(undefined, { secure_url: "https://img/new.png", public_id: "avatars/new" }));

        const next = await upload("image/png", user);
        assert.equal(next.status, 200);
    });

    it("saves the new photo and keeps it when removing the old one fails", async () => {
        const user = makeUser({ avatarPublicId: "avatars/old" });
        mock.method(User, "findById", async () => user);
        mock.method(user, "save", async () => user);
        mockUpload((callback) => callback(undefined, { secure_url: "https://img/new.png", public_id: "avatars/new" }));
        const destroy = mock.method(cloudinary.uploader, "destroy", async () => {
            throw new Error("not found");
        });

        const { status, json } = await upload("image/jpeg", user);

        assert.equal(status, 200);
        assert.equal(json.avatarUrl, "https://img/new.png");
        assert.equal(user.avatarPublicId, "avatars/new");
        assert.equal(destroy.mock.calls[0]!.arguments[0], "avatars/old");
    });

    it("refuses SVG with 400 before anything is uploaded", async () => {
        const user = makeUser();
        mock.method(User, "findById", async () => user);
        const uploadStream = mockUpload(() => {});

        const { status, json } = await upload("image/svg+xml", user);

        assert.equal(status, 400);
        assert.match(json.message, /^only jpeg, png, webp, gif or heic/);
        assert.equal(uploadStream.mock.callCount(), 0);
    });
});
