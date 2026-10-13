import { afterEach, describe, expect, it, vi } from "vitest"
import { ANYWHERE_IDEAS } from "./flare-ideas.anywhere.data"
import { FLARE_IDEAS } from "./flare-ideas.data"
import {
  KEPT_FLARE_DRAFT_KEY,
  RESUME_PATH,
  RESUME_REDIRECT_QUERY,
  clearKeptFlareDraft,
  isResumeSearch,
  keepFlareDraft,
  readKeptFlareDraft,
} from "./kept-flare-draft"
import { getSafeRedirectPath } from "./redirect-path"

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

const IDEA = FLARE_IDEAS[0]

describe("kept flare draft (#389)", () => {
  it("round-trips an idea", () => {
    keepFlareDraft({ idea: IDEA })
    expect(readKeptFlareDraft()).toEqual({ idea: IDEA })
  })

  it("round-trips a place-less idea (#515) by its id alone", () => {
    const anywhere = ANYWHERE_IDEAS[0]
    keepFlareDraft({ idea: anywhere })
    expect(window.sessionStorage.getItem(KEPT_FLARE_DRAFT_KEY)).toBe(
      JSON.stringify({ ideaId: anywhere.id })
    )
    expect(readKeptFlareDraft()).toEqual({ idea: anywhere })
  })

  it("round-trips a blank flare", () => {
    keepFlareDraft({ idea: null })
    expect(readKeptFlareDraft()).toEqual({ idea: null })
  })

  it("stores only the idea's id, never its text", () => {
    keepFlareDraft({ idea: IDEA })
    expect(window.sessionStorage.getItem(KEPT_FLARE_DRAFT_KEY)).toBe(
      JSON.stringify({ ideaId: IDEA.id })
    )
  })

  it("reads an idea that's no longer listed as a blank flare", () => {
    window.sessionStorage.setItem(
      KEPT_FLARE_DRAFT_KEY,
      JSON.stringify({ ideaId: "gone-for-good" })
    )
    expect(readKeptFlareDraft()).toEqual({ idea: null })
  })

  it("has no draft when nothing or junk is stored", () => {
    expect(readKeptFlareDraft()).toBeNull()
    window.sessionStorage.setItem(KEPT_FLARE_DRAFT_KEY, "{not json")
    expect(readKeptFlareDraft()).toBeNull()
    window.sessionStorage.setItem(KEPT_FLARE_DRAFT_KEY, "42")
    expect(readKeptFlareDraft()).toBeNull()
  })

  it("clears the draft", () => {
    keepFlareDraft({ idea: IDEA })
    clearKeptFlareDraft()
    expect(readKeptFlareDraft()).toBeNull()
  })

  it("never throws when storage is blocked", () => {
    // Some browsers throw on the sessionStorage getter itself.
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError")
    })

    expect(() => keepFlareDraft({ idea: IDEA })).not.toThrow()
    expect(readKeptFlareDraft()).toBeNull()
    expect(() => clearKeptFlareDraft()).not.toThrow()
  })
})

describe("the trip back", () => {
  it("survives the auth pages' redirect check", () => {
    expect(getSafeRedirectPath(RESUME_PATH)).toBe(RESUME_PATH)
    const target = new URLSearchParams(RESUME_REDIRECT_QUERY).get("redirectTo")
    expect(target).toBe(RESUME_PATH)
  })

  it("recognises the resume query and nothing else", () => {
    expect(isResumeSearch("?resume=flare")).toBe(true)
    expect(isResumeSearch("?resume=flare&x=1")).toBe(true)
    expect(isResumeSearch("")).toBe(false)
    expect(isResumeSearch("?resume=other")).toBe(false)
  })
})
