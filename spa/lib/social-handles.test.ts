import { describe, expect, it } from "vitest"
import {
  bioLength,
  normalizeBio,
  normalizeInstagram,
  normalizeTelegram,
} from "./social-handles"

// The cases mirror auth-server/test/profileFields.test.ts, so the edit form
// and the server agree on what is stored and what is refused.

const ok = (value: string | null) => ({ ok: true, value })

describe("normalizeInstagram", () => {
  it("accepts a bare handle, @handle, and lowercases it", () => {
    expect(normalizeInstagram("sarah.kim")).toEqual(ok("sarah.kim"))
    expect(normalizeInstagram("@Sarah.Kim")).toEqual(ok("sarah.kim"))
    expect(normalizeInstagram("  @sarah_kim  ")).toEqual(ok("sarah_kim"))
  })

  it.each([
    "instagram.com/sarah.kim",
    "www.instagram.com/sarah.kim",
    "https://instagram.com/sarah.kim",
    "https://www.instagram.com/Sarah.Kim/",
    "http://www.instagram.com/sarah.kim/?igsh=abc123",
    "https://www.instagram.com/sarah.kim?utm_source=qr#top",
    "HTTPS://INSTAGRAM.COM/sarah.kim",
  ])("extracts the handle from the pasted link %s", (link) => {
    expect(normalizeInstagram(link)).toEqual(ok("sarah.kim"))
  })

  it("clears on null, empty or whitespace", () => {
    expect(normalizeInstagram(null)).toEqual(ok(null))
    expect(normalizeInstagram("")).toEqual(ok(null))
    expect(normalizeInstagram("   ")).toEqual(ok(null))
  })

  it("accepts the length bounds 1 and 30", () => {
    expect(normalizeInstagram("a")).toEqual(ok("a"))
    expect(normalizeInstagram("a".repeat(30))).toEqual(ok("a".repeat(30)))
  })

  it.each([
    "a".repeat(31),
    ".sarah",
    "sarah.",
    "sarah..kim",
    "sarah-kim",
    "sarah kim",
    "@",
    "sarah!",
  ])("rejects the invalid handle %j", (bad) => {
    expect(normalizeInstagram(bad).ok).toBe(false)
  })

  it.each([
    "https://facebook.com/sarah",
    "https://t.me/sarahkim",
    "instagram.com",
    "https://www.instagram.com/",
    "https://www.instagram.com/p/C0abc123/",
    "instagram.com/sarah/tagged",
  ])("rejects the link %s", (bad) => {
    expect(normalizeInstagram(bad).ok).toBe(false)
  })

  it("explains the rule in the error message", () => {
    const result = normalizeInstagram("sarah..kim")
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toMatch(
      /^instagram handle must be 1–30/
    )
  })
})

describe("normalizeTelegram", () => {
  it("accepts a bare handle, @handle, and lowercases it", () => {
    expect(normalizeTelegram("sarahkim")).toEqual(ok("sarahkim"))
    expect(normalizeTelegram("@Sarah_Kim")).toEqual(ok("sarah_kim"))
  })

  it.each([
    "t.me/sarahkim",
    "https://t.me/sarahkim",
    "https://t.me/SarahKim/",
    "https://t.me/sarahkim?start=hi",
    "telegram.me/sarahkim",
    "https://telegram.me/sarahkim",
    "https://www.telegram.me/sarahkim/",
  ])("extracts the handle from the pasted link %s", (link) => {
    expect(normalizeTelegram(link)).toEqual(ok("sarahkim"))
  })

  it("clears on null, empty or whitespace", () => {
    expect(normalizeTelegram(null)).toEqual(ok(null))
    expect(normalizeTelegram("")).toEqual(ok(null))
    expect(normalizeTelegram(" ")).toEqual(ok(null))
  })

  it("accepts the length bounds 5 and 32", () => {
    expect(normalizeTelegram("abcde")).toEqual(ok("abcde"))
    expect(normalizeTelegram("a".repeat(32))).toEqual(ok("a".repeat(32)))
  })

  it.each([
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
  ])("rejects %j", (bad) => {
    expect(normalizeTelegram(bad).ok).toBe(false)
  })
})

describe("normalizeBio", () => {
  it("trims and keeps the text", () => {
    expect(normalizeBio("  climbing, coffee, berlin  ")).toEqual(
      ok("climbing, coffee, berlin")
    )
  })

  it("clears on null, empty or whitespace", () => {
    expect(normalizeBio(null)).toEqual(ok(null))
    expect(normalizeBio("")).toEqual(ok(null))
    expect(normalizeBio("  \n  ")).toEqual(ok(null))
  })

  it("allows exactly 80 characters after trimming, rejects 81", () => {
    const eighty = "x".repeat(80)
    expect(normalizeBio(`   ${eighty}   `)).toEqual(ok(eighty))

    const result = normalizeBio("x".repeat(81))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toBe(
      "bio must be 80 characters or fewer"
    )
  })

  it("counts an emoji as one character", () => {
    const bio = "🔥".repeat(80)
    expect(normalizeBio(bio)).toEqual(ok(bio))
    expect(normalizeBio("🔥".repeat(81)).ok).toBe(false)
    expect(bioLength(bio)).toBe(80)
  })

  it("folds line breaks into a single space (one-line bio)", () => {
    expect(normalizeBio("coffee\n\nclimbing \r\n berlin")).toEqual(
      ok("coffee climbing berlin")
    )
    expect(bioLength("a\n\nb")).toBe(3)
  })
})
