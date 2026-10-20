import type { EventType } from "@/lib/api/events"
import { contactLinkOrigin } from "@/lib/contact-links"
import {
  formatClock,
  formatDayShort,
  type DateLabelZone,
} from "@/lib/format-date"
import { displayFlareTitle } from "@/lib/flare-title"

// A flare's own invite link (#616): `/f/<token>`. Having the link counts as
// being invited. Everything about who may see what lives in the api; this is
// only the URL shape and the words that go with it.

export const FLARE_INVITE_PREFIX = "/f/"

/** Set on the path a visitor returns to after signing up: "i'm in" was
 * already tapped, so the page redeems the link instead of asking again. */
export const FLARE_INVITE_REDEEM_PARAM = "in"

const TOKEN = /^[A-Za-z0-9_-]{1,128}$/

export function isFlareInvitePath(pathname: string): boolean {
  return pathname.startsWith(FLARE_INVITE_PREFIX)
}

export function flareInvitePath(
  token: string,
  options: { redeem?: boolean } = {}
): string {
  const path = `${FLARE_INVITE_PREFIX}${encodeURIComponent(token)}`
  return options.redeem ? `${path}?${FLARE_INVITE_REDEEM_PARAM}=1` : path
}

/** The full link a host shares, or null where there is no web origin. */
export function buildFlareInviteUrl(token: string): string | null {
  const origin = contactLinkOrigin()
  return origin ? `${origin}${flareInvitePath(token)}` : null
}

/** The token in a flare invite path (query and hash allowed), else null. */
export function parseFlareInvitePath(
  path: string | null | undefined
): { token: string; redeem: boolean } | null {
  if (!path) return null
  const [pathAndQuery] = path.split("#")
  const [pathname = "", query = ""] = pathAndQuery.split("?")
  if (!pathname.startsWith(FLARE_INVITE_PREFIX)) return null
  const raw = pathname.slice(FLARE_INVITE_PREFIX.length)
  if (!raw || raw.includes("/")) return null
  try {
    const token = decodeURIComponent(raw)
    if (!TOKEN.test(token)) return null
    return {
      token,
      redeem: new URLSearchParams(query).get(FLARE_INVITE_REDEEM_PARAM) === "1",
    }
  } catch {
    return null
  }
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

/** "now", "today 7:00 pm" or "sat, oct 31 7:00 pm": when, on the invite screen. */
export function inviteWhen(
  flare: { startAt: string | Date; endAt: string | Date },
  now: number = Date.now()
): string {
  const start = new Date(flare.startAt)
  const end = new Date(flare.endAt)
  if (now >= start.getTime() && now <= end.getTime()) return "now"
  return sameDay(start, new Date(now))
    ? `today ${formatClock(start)}`
    : `${formatDayShort(start)} ${formatClock(start)}`
}

/**
 * The message the host's share sheet is prefilled with. It is read in another
 * app, so it is written as a normal sentence, not in sponti's lowercase:
 * "Patrick invited you to drinks at klunkerkranich on Saturday, October 31
 * at 7:00 PM". The link goes alongside it, not inside it.
 */
export function flareInviteMessage(input: {
  hostName?: string | null
  title: string
  type: EventType
  startAt: string | Date
  endAt: string | Date
  now?: number
}): string {
  const first = input.hostName?.trim().split(/\s+/)[0]
  const named = first && !/^(you|host)$/i.test(first)
  // The host's own name is the sender here, so the title stays without it.
  const title = displayFlareTitle({
    title: input.title,
    type: input.type,
    isHost: true,
  })
  const who = named ? `${first} invited you to` : "You're invited to"
  return `${who} ${title}${messageWhen(input, input.now)}`
}

function messageWhen(
  flare: { startAt: string | Date; endAt: string | Date },
  now: number = Date.now()
): string {
  const start = new Date(flare.startAt)
  if (now >= start.getTime() && now <= new Date(flare.endAt).getTime())
    return ", happening now"
  return ` on ${inviteDateTime(start)}`
}

/**
 * "Saturday, October 31 at 7:00 PM": when, written out for people reading it
 * in another app (the share message, the link's preview card). Not lowercase.
 */
export function inviteDateTime(
  value: string | Date,
  zone?: DateLabelZone
): string {
  const start = new Date(value)
  const day = start.toLocaleDateString(zone?.locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: zone?.timeZone,
  })
  const time = start.toLocaleTimeString(zone?.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone?.timeZone,
  })
  return `${day} at ${time}`
}
