// POST /auth/feedback against the real router, validation, rate limit and
// error handler. The User lookup is mocked (no database) and the Resend call
// is caught at fetch, so the mail's real shape is what's asserted.
import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import mongoose from "mongoose";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { User } from "#models";
import { createAccessToken } from "#lib/tokens";

let server: Server;
let baseUrl: string;

const realFetch = globalThis.fetch;

type Mail = {
    from: string;
    to: string | string[];
    reply_to?: string;
    subject: string;
    text: string;
};

// Lets the test's own requests through and answers Resend's with an id.
const catchMail = (outcome: "ok" | "fail" = "ok") => {
    const sent: Mail[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input);
        if (!url.startsWith("https://api.resend.com")) return realFetch(input, init);
        sent.push(JSON.parse(String(init?.body)) as Mail);
        return outcome === "ok"
            ? new Response(JSON.stringify({ id: "mail-1" }), { status: 200 })
            : new Response(JSON.stringify({ name: "application_error", message: "no" }), {
                  status: 500,
              });
    });
    return sent;
};

const userId = new mongoose.Types.ObjectId();
const token = () => createAccessToken(String(userId));

const mockUser = () =>
    mock.method(User, "findById", () => ({
        select: async () => ({
            id: String(userId),
            displayName: "Sarah",
            username: "sarah",
            email: "sarah@example.com",
        }),
    }));

const send = async (body: unknown, auth: string | null = token()) => {
    const res = await realFetch(`${baseUrl}/auth/feedback`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(auth ? { authorization: `Bearer ${auth}` } : {}),
        },
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

describe("POST /auth/feedback", () => {
    it("mails the support inbox with the tester as reply-to and the context under the message", async () => {
        mockUser();
        const sent = catchMail();

        const { status } = await send({
            kind: "bug",
            message: "the join button does nothing",
            page: "/event/abc",
            build: "0.0.1 (a1b2c3d)",
            device: "platform: iPhone",
        });

        assert.equal(status, 202);
        assert.equal(sent.length, 1);
        const mail = sent[0]!;
        assert.deepEqual([mail.to].flat(), ["hello@sponti.fun"]);
        assert.equal(mail.reply_to, "sarah@example.com");
        assert.equal(mail.subject, "[sponti bug] the join button does nothing");
        assert.match(mail.text, /^the join button does nothing\n\n---\n/);
        assert.match(mail.text, /from: Sarah \(@sarah\) <sarah@example\.com>/);
        assert.match(mail.text, /screen: \/event\/abc/);
        assert.match(mail.text, /sponti build: 0\.0\.1 \(a1b2c3d\)/);
        assert.match(mail.text, /platform: iPhone/);
    });

    it("keeps line breaks out of the subject", async () => {
        mockUser();
        const sent = catchMail();

        await send({ kind: "idea", message: "first line\nBcc: someone@else.test\nmore" });

        assert.equal(sent[0]!.subject.includes("\n"), false);
        assert.equal(sent[0]!.subject.startsWith("[sponti idea] first line Bcc:"), true);
    });

    it("needs a signed-in tester", async () => {
        const sent = catchMail();

        const { status } = await send({ kind: "bug", message: "no token" }, null);

        assert.equal(status, 401);
        assert.equal(sent.length, 0);
    });

    it("rejects an unknown kind or a near-empty message without mailing", async () => {
        mockUser();
        const sent = catchMail();

        assert.equal((await send({ kind: "spam", message: "hello there" })).status, 400);
        assert.equal((await send({ kind: "bug", message: "  hi " })).status, 400);
        assert.equal((await send({ kind: "bug", message: "x".repeat(2001) })).status, 400);
        assert.equal(sent.length, 0);
    });

    it("answers 502 when the mail provider fails", async () => {
        mockUser();
        catchMail("fail");

        const { status } = await send({ kind: "bug", message: "this will not arrive" });

        assert.equal(status, 502);
    });
});
