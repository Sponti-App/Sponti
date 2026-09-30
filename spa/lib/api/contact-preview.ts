import { apiFetch } from "@/lib/http"
import type { ContactLinkKind } from "@/lib/contact-links"

/**
 * #124: the display name behind a QR or invite link, for a visitor who isn't
 * signed in yet. Unauthenticated; resolves to null for any link that isn't
 * live (expired, revoked, unknown) so the caller falls back to generic copy.
 */
export async function fetchContactPreviewName(
  kind: ContactLinkKind,
  token: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await apiFetch<{ data: { displayName: string } }>(
      "/public/contact-preview",
      { method: "POST", body: { kind, token }, auth: false, signal }
    )
    const name = response.data?.displayName?.trim()
    return name ? name : null
  } catch {
    return null
  }
}
