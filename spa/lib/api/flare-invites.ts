import type { EventType } from "@/lib/api/events"
import { apiFetch, HttpError } from "@/lib/http"
import { EVENT_TYPES } from "@/types/utils"

// #616: a flare's own invite link. The host reads and resets it
// (`/events/:id/invite-link`); whoever holds it sees a preview without an
// account (`/public/flare-invite-preview`) and, signed in, asks where they
// stand and says "i'm in" (`/flare-invites/*`). What each may see is decided in
// the api (api/API_RULES.md, "Flare Invite Links"); nothing here asks for more.

/** What anyone holding the link sees. Never the address, guests or updates. */
export type FlareInvitePreview = {
  host: { displayName: string; avatarUrl: string | null }
  title: string
  type: EventType
  startAt: string
  endAt: string
  placeName: string
}

/** Where the viewer stands with a link. */
export type FlareInviteState =
  /** Their own flare. */
  | "host"
  /** On the flare and going. */
  | "going"
  /** On the guest list, not answered. */
  | "invited"
  /** Invite-only: waiting for the host to accept the friend request. */
  | "waiting"
  /** Nothing yet: "i'm in" redeems the link. */
  | "none"

export type FlareInviteStatus = {
  state: FlareInviteState
  /** Only once on the flare (or hosting it); null while waiting or none. */
  eventId: string | null
  preview: FlareInvitePreview
}

const STATES: readonly FlareInviteState[] = [
  "host",
  "going",
  "invited",
  "waiting",
  "none",
]

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
}

/** The preview as the api sent it, or null if it isn't a usable one. */
export function adaptFlareInvitePreview(
  raw: unknown
): FlareInvitePreview | null {
  if (!raw || typeof raw !== "object") return null
  const preview = raw as Record<string, unknown>
  const host = preview.host as Record<string, unknown> | undefined
  if (!host || !isText(host.displayName)) return null
  if (!isText(preview.title)) return null
  if (!EVENT_TYPES.some((t) => t.value === preview.type)) return null
  if (!isDate(preview.startAt) || !isDate(preview.endAt)) return null
  return {
    host: {
      displayName: host.displayName,
      avatarUrl: isText(host.avatarUrl) ? host.avatarUrl : null,
    },
    title: preview.title,
    type: preview.type as EventType,
    startAt: preview.startAt,
    endAt: preview.endAt,
    placeName: typeof preview.placeName === "string" ? preview.placeName : "",
  }
}

function adaptStatus(raw: unknown): FlareInviteStatus {
  const data = (raw as { data?: Record<string, unknown> } | null)?.data
  const preview = adaptFlareInvitePreview(data?.preview)
  const state = STATES.find((s) => s === data?.state)
  if (!data || !preview || !state) {
    throw new HttpError(502, "unexpected flare invite response")
  }
  return {
    state,
    eventId: isText(data.eventId) ? data.eventId : null,
    preview,
  }
}

/**
 * The preview for someone who isn't signed in. Sent without a token, so it
 * never starts a session refresh. Null for any link that doesn't work: the
 * api says one thing for unknown, reset, ended and cancelled alike.
 */
export async function fetchFlareInvitePreview(
  token: string,
  signal?: AbortSignal
): Promise<FlareInvitePreview | null> {
  try {
    const response = await apiFetch<{ data: unknown }>(
      "/public/flare-invite-preview",
      { method: "POST", body: { token }, auth: false, signal }
    )
    return adaptFlareInvitePreview(response?.data)
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 404 || error.status === 400)
    ) {
      return null
    }
    throw error
  }
}

/** Where the signed-in viewer stands with the link. Changes nothing. */
export async function fetchFlareInviteStatus(
  token: string,
  signal?: AbortSignal
): Promise<FlareInviteStatus> {
  return adaptStatus(
    await apiFetch<unknown>("/flare-invites/status", {
      method: "POST",
      body: { token },
      signal,
    })
  )
}

/** "i'm in": redeems the link. Safe to repeat. */
export async function redeemFlareInvite(
  token: string,
  signal?: AbortSignal
): Promise<FlareInviteStatus> {
  return adaptStatus(
    await apiFetch<unknown>("/flare-invites/redeem", {
      method: "POST",
      body: { token },
      signal,
    })
  )
}

/** The host's link for a flare (issued the first time it is asked for). */
export async function fetchEventInviteLink(
  eventId: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await apiFetch<{ data: { token?: unknown } }>(
    `/events/${encodeURIComponent(eventId)}/invite-link`,
    { signal }
  )
  const token = response?.data?.token
  if (!isText(token))
    throw new HttpError(502, "unexpected invite link response")
  return token
}

/** Replaces the host's link: the old one stops working at once. */
export async function resetEventInviteLink(eventId: string): Promise<string> {
  const response = await apiFetch<{ data: { token?: unknown } }>(
    `/events/${encodeURIComponent(eventId)}/invite-link/reset`,
    { method: "POST", body: {} }
  )
  const token = response?.data?.token
  if (!isText(token))
    throw new HttpError(502, "unexpected invite link response")
  return token
}
