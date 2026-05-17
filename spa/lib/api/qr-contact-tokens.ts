import { apiFetch } from "@/lib/http"

export type QrRelationship =
  | "self"
  | "connected"
  | "pending_outgoing"
  | "pending_incoming"
  | "none"

export type QrContactToken = {
  token: string
  expiresAt: string
  expiresInSeconds: number
}

export type QrContactProfile = {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
}

export type QrContactResolveResult = {
  profile: QrContactProfile
  relationship: QrRelationship
  canConnect: boolean
  expiresAt: string
  connection: {
    processed: boolean
    delivered: boolean
    autoAccepted: boolean
  } | null
}

export function createQrContactToken(
  signal?: AbortSignal
): Promise<QrContactToken> {
  return apiFetch<{ data: QrContactToken }>("/qr-contact-tokens", {
    method: "POST",
    body: {},
    signal,
  }).then((response) => response.data)
}

export function resolveQrContactToken(
  token: string,
  connect = false,
  signal?: AbortSignal
): Promise<QrContactResolveResult> {
  return apiFetch<{ data: QrContactResolveResult }>("/qr-contact-tokens/resolve", {
    method: "POST",
    body: { token, connect },
    signal,
  }).then((response) => response.data)
}
