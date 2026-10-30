import { describe, expect, it } from "vitest"
import { detectHomeScreenMode, type HomeScreenEnv } from "./home-screen"

// #641: who is offered "add to home screen", and how.

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1"
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0 Safari/604.1"
// iPadOS 13+ Safari asks for the desktop site by default.
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

const env = (overrides: Partial<HomeScreenEnv>): HomeScreenEnv => ({
  userAgent: DESKTOP_CHROME,
  maxTouchPoints: 0,
  standalone: false,
  hasPrompt: false,
  ...overrides,
})

describe("detectHomeScreenMode", () => {
  it("shows the steps on iPhone Safari, with no prompt needed", () => {
    expect(detectHomeScreenMode(env({ userAgent: IPHONE_SAFARI }))).toBe("ios")
  })

  it("treats iPad Safari in desktop mode (Macintosh with touch) as iOS", () => {
    expect(
      detectHomeScreenMode(env({ userAgent: IPAD_SAFARI, maxTouchPoints: 5 }))
    ).toBe("ios")
    expect(detectHomeScreenMode(env({ userAgent: IPAD_SAFARI }))).toBe("none")
  })

  it("offers nothing in other iPhone browsers or in-app webviews", () => {
    expect(detectHomeScreenMode(env({ userAgent: IPHONE_CHROME }))).toBe("none")
    expect(detectHomeScreenMode(env({ userAgent: IPHONE_INSTAGRAM }))).toBe(
      "none"
    )
  })

  it("offers the install prompt on Android once the browser has handed it over", () => {
    expect(detectHomeScreenMode(env({ userAgent: ANDROID_CHROME }))).toBe(
      "none"
    )
    expect(
      detectHomeScreenMode(env({ userAgent: ANDROID_CHROME, hasPrompt: true }))
    ).toBe("prompt")
  })

  it("never offers it to the installed app", () => {
    expect(
      detectHomeScreenMode(env({ userAgent: IPHONE_SAFARI, standalone: true }))
    ).toBe("none")
    expect(
      detectHomeScreenMode(
        env({ userAgent: ANDROID_CHROME, hasPrompt: true, standalone: true })
      )
    ).toBe("none")
  })

  it("does not offer a desktop browser, even one that fires the prompt", () => {
    expect(detectHomeScreenMode(env({ hasPrompt: true }))).toBe("none")
  })
})
