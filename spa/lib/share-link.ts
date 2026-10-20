// Hands a link to the phone's share sheet, or copies it where there is none
// (a desktop browser, an in-app webview). One place for the three outcomes so
// each screen reacts the same way.

export type ShareLinkResult =
  /** The share sheet took it (or was opened; there is no way to tell more). */
  | "shared"
  /** No share sheet: the link is on the clipboard. */
  | "copied"
  /** They closed the share sheet. Not an error. */
  | "cancelled"
  /** Neither worked. */
  | "failed"

function isCancellation(error: unknown): boolean {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : ""
  return name === "AbortError"
}

type ShareEnvironment = {
  share?: (data: { text?: string; url?: string }) => Promise<void>
  writeText?: (text: string) => Promise<void>
}

function browserEnvironment(): ShareEnvironment {
  if (typeof navigator === "undefined") return {}
  return {
    share:
      typeof navigator.share === "function"
        ? (data) => navigator.share(data)
        : undefined,
    writeText: navigator.clipboard?.writeText
      ? (text) => navigator.clipboard.writeText(text)
      : undefined,
  }
}

/**
 * Opens the share sheet with `text` and `url`; if the browser has none, copies
 * just `url`. Call it straight from the tap: a share sheet only opens inside
 * the gesture that asked for it.
 */
export async function shareLink(
  { text, url }: { text: string; url: string },
  environment: ShareEnvironment = browserEnvironment()
): Promise<ShareLinkResult> {
  if (environment.share) {
    try {
      await environment.share({ text, url })
      return "shared"
    } catch (error) {
      return isCancellation(error) ? "cancelled" : "failed"
    }
  }
  if (environment.writeText) {
    try {
      await environment.writeText(url)
      return "copied"
    } catch {
      return "failed"
    }
  }
  return "failed"
}
