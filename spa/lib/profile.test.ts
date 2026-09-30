import { afterEach, describe, expect, it } from "vitest"
import {
  clearLegacyHandles,
  parseProfileErrors,
  readLegacyHandles,
} from "./profile"

const KEY = "sponti.profile.extras.v1"

afterEach(() => window.localStorage.clear())

describe("legacy device handles (#289)", () => {
  it("reads what this device kept for one user", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        a: { instagram: " sarah ", telegram: "" },
        b: { instagram: "", telegram: "" },
      })
    )
    expect(readLegacyHandles("a")).toEqual({ instagram: "sarah", telegram: "" })
    expect(readLegacyHandles("b")).toBeNull()
    expect(readLegacyHandles("c")).toBeNull()
  })

  it("treats a missing or broken store as nothing to offer", () => {
    expect(readLegacyHandles("a")).toBeNull()
    window.localStorage.setItem(KEY, "{nope")
    expect(readLegacyHandles("a")).toBeNull()
    window.localStorage.setItem(KEY, "[]")
    expect(readLegacyHandles("a")).toBeNull()
  })

  it("clearing removes the key once no account is left in it", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        a: { instagram: "x", telegram: "" },
        b: { instagram: "y", telegram: "" },
      })
    )
    clearLegacyHandles("a")
    expect(readLegacyHandles("a")).toBeNull()
    expect(readLegacyHandles("b")).toEqual({ instagram: "y", telegram: "" })

    clearLegacyHandles("b")
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe("parseProfileErrors", () => {
  it("splits the validator's blocks by field, in lowercase", () => {
    const message = [
      "✖ Instagram handle must be 1–30 letters, numbers, periods or underscores",
      "  → at instagram",
      "✖ Bio must be 80 characters or fewer",
      "  → at bio",
    ].join("\n")
    expect(parseProfileErrors(message)).toEqual({
      instagram:
        "instagram handle must be 1–30 letters, numbers, periods or underscores",
      bio: "bio must be 80 characters or fewer",
    })
  })

  it("puts any other message under general", () => {
    expect(parseProfileErrors("Username already taken")).toEqual({
      general: "username already taken",
    })
  })
})
