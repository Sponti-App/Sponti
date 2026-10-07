import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearRegisterDraft,
  readRegisterDraft,
  REGISTER_DRAFT_KEY,
  writeRegisterDraft,
} from "./register-draft"

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

describe("register draft (#300)", () => {
  it("round-trips name, username and email", () => {
    writeRegisterDraft({
      displayName: "Sam",
      username: "sam",
      email: "sam@example.com",
    })

    expect(readRegisterDraft()).toEqual({
      displayName: "Sam",
      username: "sam",
      email: "sam@example.com",
    })
  })

  it("never stores a password, even when one is passed in", () => {
    const withPassword = {
      displayName: "Sam",
      username: "sam",
      email: "sam@example.com",
      password: "hunter2hunter2",
    }

    writeRegisterDraft(withPassword)

    const stored = window.sessionStorage.getItem(REGISTER_DRAFT_KEY) ?? ""
    expect(stored).not.toContain("hunter2hunter2")
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual([
      "displayName",
      "email",
      "username",
    ])
  })

  it("drops anything but the three fields when reading", () => {
    window.sessionStorage.setItem(
      REGISTER_DRAFT_KEY,
      JSON.stringify({ displayName: "Sam", username: 4, password: "x" })
    )

    expect(readRegisterDraft()).toEqual({
      displayName: "Sam",
      username: "",
      email: "",
    })
  })

  it("removes the key when every field is empty", () => {
    writeRegisterDraft({ displayName: "S", username: "", email: "" })
    writeRegisterDraft({ displayName: "", username: "", email: "" })

    expect(window.sessionStorage.getItem(REGISTER_DRAFT_KEY)).toBeNull()
    expect(readRegisterDraft()).toBeNull()
  })

  it("clears the draft", () => {
    writeRegisterDraft({ displayName: "Sam", username: "sam", email: "" })

    clearRegisterDraft()

    expect(readRegisterDraft()).toBeNull()
  })

  it("ignores a draft that isn't JSON", () => {
    window.sessionStorage.setItem(REGISTER_DRAFT_KEY, "{not json")

    expect(readRegisterDraft()).toBeNull()
  })

  it("does nothing when storage throws", () => {
    // Some browsers throw on the sessionStorage getter itself. Spying on
    // Storage.prototype doesn't reach jsdom's window.sessionStorage (#458).
    const getter = vi
      .spyOn(window, "sessionStorage", "get")
      .mockImplementation(() => {
        throw new Error("SecurityError")
      })

    expect(() =>
      writeRegisterDraft({ displayName: "Sam", username: "", email: "" })
    ).not.toThrow()
    expect(() => clearRegisterDraft()).not.toThrow()
    expect(readRegisterDraft()).toBeNull()
    // Each of the three calls above reached the throwing getter.
    expect(getter).toHaveBeenCalledTimes(3)
  })
})
