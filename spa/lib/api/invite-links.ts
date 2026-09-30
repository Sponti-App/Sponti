import { apiFetch } from "@/lib/http"
import type { QrContactResolveResult } from "@/lib/api/qr-contact-tokens"

// #124: the 7-day, revocable link shared in group chats. Opening one sends
// its owner a connection request (never an instant connection).

export type InviteLink = {
  token: string
  expiresAt: string
  expiresInSeconds: number
}

export type InviteLinkResolveResult = QrContactResolveResult

export function getMyInviteLink(signal?: AbortSignal): Promise<InviteLink> {
  return apiFetch<{ data: InviteLink }>("/invite-links/me", { signal }).then(
    (response) => response.data
  )
}

/** Revokes the current link (it stops working) and returns a new one. */
export function resetMyInviteLink(): Promise<InviteLink> {
  return apiFetch<{ data: InviteLink }>("/invite-links/me/reset", {
    method: "POST",
    body: {},
  }).then((response) => response.data)
}

export function resolveInviteLink(
  token: string,
  connect = false,
  signal?: AbortSignal
): Promise<InviteLinkResolveResult> {
  return apiFetch<{ data: InviteLinkResolveResult }>("/invite-links/resolve", {
    method: "POST",
    body: { token, connect },
    signal,
  }).then((response) => response.data)
}
