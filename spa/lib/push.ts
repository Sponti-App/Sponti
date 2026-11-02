import {
  fetchVapidPublicKey,
  registerPushSubscription,
  removePushSubscription,
} from "@/lib/api/push-subscriptions"

// Web push on this device (#640; the api side is #639).

export type PushState =
  /** No web push here (an old browser, or push is off on the server). */
  | "unsupported"
  /** iPhone or iPad in a Safari tab: push needs the home-screen app (#641). */
  | "needs-home-screen"
  /** The browser was told no; only its own site settings can undo that. */
  | "denied"
  | "off"
  | "on"

const SW_PATH = "/sw.js"

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  // iPadOS reports itself as a Mac, so a touch screen gives it away.
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  )
}

function browserSupportsPush(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported"
  if (!browserSupportsPush()) {
    // In a Safari tab, iOS hides PushManager entirely; the home-screen app has it.
    return isIos(navigator.userAgent, navigator.maxTouchPoints)
      ? "needs-home-screen"
      : "unsupported"
  }
  if (Notification.permission === "denied") return "denied"
  if (Notification.permission === "granted" && (await currentSubscription()))
    return "on"
  return "off"
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/")
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function sendToApi(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return
  await registerPushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

/**
 * Asks the browser (its own prompt) and subscribes this device. Must run from
 * a tap: iOS only shows the prompt for a user gesture. Resolves to the state
 * it ended in.
 */
export async function turnPushOn(): Promise<PushState> {
  if (!browserSupportsPush()) return getPushState()
  const publicKey = await fetchVapidPublicKey()
  if (!publicKey) return "unsupported"

  const permission = await Notification.requestPermission()
  if (permission !== "granted")
    return permission === "denied" ? "denied" : "off"

  const registration = await navigator.serviceWorker.register(SW_PATH)
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))
  await sendToApi(subscription)
  return "on"
}

/** Stops push on this device: the api forgets it, then the browser does. */
export async function turnPushOff(): Promise<void> {
  if (typeof window === "undefined" || !browserSupportsPush()) return
  const subscription = await currentSubscription()
  if (!subscription) return
  try {
    await removePushSubscription(subscription.endpoint)
  } finally {
    await subscription.unsubscribe()
  }
}

/**
 * On each signed-in start: tells the api this device's subscription again, so
 * it follows whoever is signed in now and picks up a changed timezone.
 */
export async function resyncPush(): Promise<void> {
  if (typeof window === "undefined" || !browserSupportsPush()) return
  if (Notification.permission !== "granted") return
  const subscription = await currentSubscription()
  if (subscription) await sendToApi(subscription)
}

const ASKED_KEY = "sponti:push-asked"

/** The soft in-app ask is offered once per device. */
export function pushAskSeen(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1"
  } catch {
    return true
  }
}

export function markPushAskSeen(): void {
  try {
    localStorage.setItem(ASKED_KEY, "1")
  } catch {
    // Private mode: the ask may come back once; harmless.
  }
}
