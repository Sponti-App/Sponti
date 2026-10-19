import { describe, expect, it, vi } from "vitest"
import { shareLink } from "./share-link"

const message = {
  text: "patrick invited you to drinks, sat 7:00 pm",
  url: "https://x/f/a",
}

describe("shareLink", () => {
  it("opens the share sheet with the message and the link", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()

    expect(await shareLink(message, { share, writeText })).toBe("shared")

    expect(share).toHaveBeenCalledWith(message)
    expect(writeText).not.toHaveBeenCalled()
  })

  it("treats closing the share sheet as cancelled, not as an error", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }))

    expect(await shareLink(message, { share })).toBe("cancelled")
  })

  it("reports a share sheet that failed", async () => {
    const share = vi.fn().mockRejectedValue(new Error("no targets"))

    expect(await shareLink(message, { share })).toBe("failed")
  })

  it("copies just the link when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    expect(await shareLink(message, { writeText })).toBe("copied")

    expect(writeText).toHaveBeenCalledWith("https://x/f/a")
  })

  it("fails when it cannot copy either", async () => {
    expect(await shareLink(message, {})).toBe("failed")
    expect(
      await shareLink(message, {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      })
    ).toBe("failed")
  })
})
