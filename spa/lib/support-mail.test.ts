import { describe, expect, it } from "vitest"
import { CONTACT_EMAIL } from "@/lib/contact"
import {
  buildSupportBody,
  describeBuild,
  describeDevice,
  supportMailto,
} from "@/lib/support-mail"

describe("describeBuild", () => {
  it("joins the version and a short commit", () => {
    expect(describeBuild("0.0.1", "a1b2c3d4e5f6")).toBe("0.0.1 (a1b2c3d)")
  })

  it("falls back to whichever part the build knows", () => {
    expect(describeBuild("0.0.1", "")).toBe("0.0.1")
    expect(describeBuild("", "a1b2c3d4e5f6")).toBe("a1b2c3d")
    expect(describeBuild("", "")).toBe("unknown")
  })
})

describe("describeDevice", () => {
  it("lists platform, browser, language and screen size", () => {
    expect(
      describeDevice({
        navigator: {
          userAgent: "UA/1.0",
          platform: "iPhone",
          language: "en-GB",
        },
        screen: { width: 390, height: 844 },
        pixelRatio: 3,
      })
    ).toBe(
      [
        "platform: iPhone",
        "browser: UA/1.0",
        "language: en-GB",
        "screen: 390x844 @3x",
      ].join("\n")
    )
  })

  it("is empty when there is no browser", () => {
    expect(describeDevice(null)).toBe("")
  })

  it("reads this browser by default", () => {
    expect(describeDevice()).toContain(`browser: ${navigator.userAgent}`)
  })
})

describe("supportMailto", () => {
  it("mails the one contact address with the subject and device in the body", () => {
    const href = supportMailto(
      "bug report",
      "platform: iPhone",
      "0.0.1 (a1b2c3d)"
    )
    const url = new URL(href)

    expect(url.protocol).toBe("mailto:")
    expect(decodeURIComponent(url.pathname)).toBe(CONTACT_EMAIL)
    expect(url.searchParams.get("subject")).toBe("bug report")
    const body = url.searchParams.get("body") ?? ""
    expect(body).toContain("sponti build: 0.0.1 (a1b2c3d)")
    expect(body).toContain("platform: iPhone")
    // room to write above the details
    expect(body.startsWith("\n\n\n")).toBe(true)
    expect(body).toBe(buildSupportBody("platform: iPhone", "0.0.1 (a1b2c3d)"))
  })
})
