import {
  adaptFlareInvitePreview,
  type FlareInvitePreview,
} from "@/lib/api/flare-invites"
import { inviteDateTime } from "@/lib/flare-invite-links"
import { displayFlareTitle } from "@/lib/flare-title"
import type { DateLabelZone } from "@/lib/format-date"
import { EVENT_TYPES } from "@/types/utils"

// #616: the link preview of a flare's invite link (`/f/<token>`), the card a
// chat app shows when the link is pasted into it. It is built on the server,
// from the same public endpoint the signed-out page uses, so it can only ever
// show what that page shows: who invited them, the title, the kind, the time
// and the place name. Never the address, coordinates, guests or updates.
//
// A link that doesn't work (unknown, reset, ended, cancelled, host gone, or the
// api unreachable or rate limiting us) comes back as null, and the caller falls
// back to the site's generic preview. Nothing here says which of those it was.

const TOKEN = /^[A-Za-z0-9_-]{1,128}$/
const FETCH_TIMEOUT_MS = 4_000

/** Flares are in berlin for now, and a server has no viewer's clock to ask. */
export const PREVIEW_ZONE: DateLabelZone = {
  timeZone: "Europe/Berlin",
  locale: "en-US",
}

export function isFlareInviteToken(value: string): boolean {
  return TOKEN.test(value)
}

/** The api's absolute URL: the first http(s) entry of the shared base-URL
 * setting (it may also list a relative dev proxy path). */
function apiBaseUrl(): string | null {
  const candidates = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
    .split(",")
    .map((candidate) => candidate.trim().replace(/\/+$/, ""))
  const found = candidates.find((candidate) => /^https?:\/\//.test(candidate))
  return found ? found.replace(/\/api\/v1$/, "") : null
}

/**
 * The preview for a link, or null for any link that doesn't work. Never
 * cached: a reset or ended link must stop previewing at once.
 */
export async function fetchFlareInvitePreviewOnServer(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<FlareInvitePreview | null> {
  const base = apiBaseUrl()
  if (!base || !isFlareInviteToken(token)) return null
  try {
    const response = await fetchImpl(
      `${base}/api/v1/public/flare-invite-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    )
    if (!response.ok) return null
    return adaptFlareInvitePreview(
      ((await response.json()) as { data?: unknown })?.data
    )
  } catch {
    return null
  }
}

export type FlareInviteCard = {
  /** "patrick invited you to drinks at klunkerkranich" */
  title: string
  /** "Drinks · Saturday, October 24 at 7:00 PM · klunkerkranich" */
  description: string
  /** The host as written, for the image's photo placeholder. */
  hostName: string
  /** "Patrick invited you" */
  invitedLine: string
  /** The title as the host wrote it. */
  flareTitle: string
  /** The time and place line, without the category. */
  meta: string
}

/**
 * The words of the preview. It is read in a chat app, so like the share
 * message it is written as normal sentences, not in sponti's lowercase, and
 * names, titles and places stay as typed.
 */
export function flareInviteCard(
  preview: FlareInvitePreview,
  now: number = Date.now()
): FlareInviteCard {
  const first = preview.host.displayName.trim().split(/\s+/)[0]
  const flareTitle = displayFlareTitle({
    title: preview.title,
    type: preview.type,
    isHost: true,
  })
  const start = new Date(preview.startAt).getTime()
  const end = new Date(preview.endAt).getTime()
  const when =
    now >= start && now <= end
      ? "Happening now"
      : inviteDateTime(preview.startAt, PREVIEW_ZONE)
  const label = EVENT_TYPES.find((t) => t.value === preview.type)?.label
  const kind = label && label.charAt(0).toUpperCase() + label.slice(1)
  const meta = [when, preview.placeName].filter(Boolean).join(" · ")
  return {
    title: `${first} invited you to ${flareTitle}`,
    description: [kind, meta].filter(Boolean).join(" · "),
    hostName: preview.host.displayName,
    invitedLine: `${first} invited you`,
    flareTitle,
    meta,
  }
}
