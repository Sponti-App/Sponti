import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeBio, normalizeInstagram, normalizeTelegram } from "#lib/profileFields";

const ok = (value: string | null) => ({ ok: true, value });

describe("normalizeInstagram", () => {
    it("accepts a bare handle, @handle, and lowercases it", () => {
        assert.deepEqual(normalizeInstagram("sarah.kim"), ok("sarah.kim"));
        assert.deepEqual(normalizeInstagram("@Sarah.Kim"), ok("sarah.kim"));
        assert.deepEqual(normalizeInstagram("  @sarah_kim  "), ok("sarah_kim"));
    });

    it("extracts the handle from a pasted profile link", () => {
        for (const link of [
            "instagram.com/sarah.kim",
            "www.instagram.com/sarah.kim",
            "https://instagram.com/sarah.kim",
            "https://www.instagram.com/Sarah.Kim/",
            "http://www.instagram.com/sarah.kim/?igsh=abc123",
            "https://www.instagram.com/sarah.kim?utm_source=qr#top",
            "HTTPS://INSTAGRAM.COM/sarah.kim",
        ]) {
            assert.deepEqual(normalizeInstagram(link), ok("sarah.kim"), link);
        }
    });

    it("clears on null, empty or whitespace", () => {
        assert.deepEqual(normalizeInstagram(null), ok(null));
        assert.deepEqual(normalizeInstagram(""), ok(null));
        assert.deepEqual(normalizeInstagram("   "), ok(null));
    });

    it("accepts the length bounds 1 and 30", () => {
        assert.deepEqual(normalizeInstagram("a"), ok("a"));
        assert.deepEqual(normalizeInstagram("a".repeat(30)), ok("a".repeat(30)));
    });

    it("rejects invalid handles", () => {
        for (const bad of [
            "a".repeat(31),
            ".sarah",
            "sarah.",
            "sarah..kim",
            "sarah-kim",
            "sarah kim",
            "@",
            "sarah!",
        ]) {
            const result = normalizeInstagram(bad);
            assert.equal(result.ok, false, bad);
        }
    });

    it("rejects links to other sites or to non-profile pages", () => {
        for (const bad of [
            "https://facebook.com/sarah",
            "https://t.me/sarahkim",
            "instagram.com",
            "https://www.instagram.com/",
            "https://www.instagram.com/p/C0abc123/",
            "instagram.com/sarah/tagged",
        ]) {
            const result = normalizeInstagram(bad);
            assert.equal(result.ok, false, bad);
        }
    });

    it("explains the rule in the error message", () => {
        const result = normalizeInstagram("sarah..kim");
        assert.equal(result.ok, false);
        assert.match(!result.ok ? result.message : "", /^Instagram handle must be 1–30/);
    });
});

describe("normalizeTelegram", () => {
    it("accepts a bare handle, @handle, and lowercases it", () => {
        assert.deepEqual(normalizeTelegram("sarahkim"), ok("sarahkim"));
        assert.deepEqual(normalizeTelegram("@Sarah_Kim"), ok("sarah_kim"));
    });

    it("extracts the handle from t.me and telegram.me links", () => {
        for (const link of [
            "t.me/sarahkim",
            "https://t.me/sarahkim",
            "https://t.me/SarahKim/",
            "https://t.me/sarahkim?start=hi",
            "telegram.me/sarahkim",
            "https://telegram.me/sarahkim",
            "https://www.telegram.me/sarahkim/",
        ]) {
            assert.deepEqual(normalizeTelegram(link), ok("sarahkim"), link);
        }
    });

    it("clears on null, empty or whitespace", () => {
        assert.deepEqual(normalizeTelegram(null), ok(null));
        assert.deepEqual(normalizeTelegram(""), ok(null));
        assert.deepEqual(normalizeTelegram(" "), ok(null));
    });

    it("accepts the length bounds 5 and 32", () => {
        assert.deepEqual(normalizeTelegram("abcde"), ok("abcde"));
        assert.deepEqual(normalizeTelegram("a".repeat(32)), ok("a".repeat(32)));
    });

    it("rejects invalid handles and links", () => {
        for (const bad of [
            "abcd",
            "a".repeat(33),
            "1sarah",
            "_sarah",
            "sarah.kim",
            "sarah-kim",
            "https://t.me/+AbCdEfGh",
            "https://t.me/s/sarahkim",
            "https://instagram.com/sarahkim",
            "t.me",
        ]) {
            const result = normalizeTelegram(bad);
            assert.equal(result.ok, false, bad);
        }
    });
});

describe("normalizeBio", () => {
    it("trims and keeps the text", () => {
        assert.deepEqual(normalizeBio("  climbing, coffee, berlin  "), ok("climbing, coffee, berlin"));
    });

    it("clears on null, empty or whitespace", () => {
        assert.deepEqual(normalizeBio(null), ok(null));
        assert.deepEqual(normalizeBio(""), ok(null));
        assert.deepEqual(normalizeBio("  \n  "), ok(null));
    });

    it("allows exactly 80 characters after trimming, rejects 81", () => {
        const eighty = "x".repeat(80);
        assert.deepEqual(normalizeBio(`   ${eighty}   `), ok(eighty));

        const result = normalizeBio("x".repeat(81));
        assert.equal(result.ok, false);
        assert.equal(!result.ok && result.message, "Bio must be 80 characters or fewer");
    });

    it("counts an emoji as one character", () => {
        const bio = "🔥".repeat(80);
        assert.deepEqual(normalizeBio(bio), ok(bio));
        assert.equal(normalizeBio("🔥".repeat(81)).ok, false);
    });

    it("folds line breaks into a single space (one-line bio)", () => {
        assert.deepEqual(normalizeBio("coffee\n\nclimbing \r\n berlin"), ok("coffee climbing berlin"));
    });
});
