import { describe, expect, it } from "vitest"
import { extractErrorPayload } from "./http"

describe("extractErrorPayload", () => {
  // api/ wraps errors; auth-server/ does not. The client has to read both, or
  // one of the two services can never explain itself to the user.
  it("reads the nested envelope emitted by api/", () => {
    expect(
      extractErrorPayload(
        {
          error: {
            message: "Missing Bearer access token",
            code: "ACCESS_TOKEN_MISSING",
          },
        },
        "Unauthorized"
      )
    ).toEqual({
      message: "Missing Bearer access token",
      code: "ACCESS_TOKEN_MISSING",
      details: undefined,
    })
  })

  // Regression guard: this shape used to be dropped entirely, so a wrong
  // password showed the user "Unauthorized" instead of the real reason.
  it("reads the flat envelope emitted by auth-server/", () => {
    expect(
      extractErrorPayload(
        { message: "Invalid email or password" },
        "Unauthorized"
      )
    ).toEqual({
      message: "Invalid email or password",
      code: undefined,
      details: undefined,
    })
  })

  it("carries validation details through for field-level messages", () => {
    const issues = [{ path: ["email"], message: "Invalid email" }]
    expect(
      extractErrorPayload(
        { error: { message: "Validation failed", details: issues } },
        "Bad Request"
      ).details
    ).toBe(issues)
  })

  it("prefers the nested envelope when a body somehow carries both", () => {
    expect(
      extractErrorPayload(
        { message: "flat", error: { message: "nested" } },
        "fallback"
      ).message
    ).toBe("nested")
  })

  it("falls back to the status text for an unparseable body", () => {
    expect(extractErrorPayload(null, "Service Unavailable")).toEqual({
      message: "Service Unavailable",
    })
    expect(extractErrorPayload("not json", "Bad Gateway").message).toBe(
      "Bad Gateway"
    )
  })

  it("falls back when a message is present but blank", () => {
    expect(
      extractErrorPayload({ message: "   " }, "Unauthorized").message
    ).toBe("Unauthorized")
  })
})
