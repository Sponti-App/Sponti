import { apiFetch } from "@/lib/http"

// api/src/routes/pushSubscriptionRoutes.ts (#639).

export function fetchVapidPublicKey(): Promise<string | null> {
  return apiFetch<{ data: { publicKey: string | null } }>(
    "/push-subscriptions/vapid-public-key"
  ).then((res) => res.data.publicKey)
}

export function registerPushSubscription(body: {
  endpoint: string
  keys: { p256dh: string; auth: string }
  timeZone?: string
}): Promise<void> {
  return apiFetch<void>("/push-subscriptions", { method: "POST", body })
}

export function removePushSubscription(endpoint: string): Promise<void> {
  return apiFetch<void>("/push-subscriptions", {
    method: "DELETE",
    body: { endpoint },
  })
}
