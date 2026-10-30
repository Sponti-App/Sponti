import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  fetchVapidPublicKey: vi.fn(),
  registerPushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
}))
vi.mock("@/lib/api/push-subscriptions", () => api)

import { getPushState, isIos, resyncPush, turnPushOff } from "@/lib/push"

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"

type Sub = { endpoint: string; toJSON: () => unknown; unsubscribe: () => void }

function stubBrowser({
  push = true,
  permission = "default",
  subscription = null,
  userAgent = MAC,
  touch = 0,
}: {
  push?: boolean
  permission?: NotificationPermission
  subscription?: Sub | null
  userAgent?: string
  touch?: number
}) {
  const registration = {
    pushManager: { getSubscription: vi.fn(async () => subscription) },
  }
  vi.stubGlobal("navigator", {
    userAgent,
    maxTouchPoints: touch,
    ...(push
      ? { serviceWorker: { getRegistration: vi.fn(async () => registration) } }
      : {}),
  })
  if (push) {
    vi.stubGlobal("PushManager", class {})
    vi.stubGlobal("Notification", { permission })
  } else {
    // @ts-expect-error -- removing for the test
    delete window.PushManager
  }
}

function subscription(): Sub {
  return {
    endpoint: "https://push.example/a",
    toJSON: () => ({
      endpoint: "https://push.example/a",
      keys: { p256dh: "k", auth: "a" },
    }),
    unsubscribe: vi.fn(),
  }
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("isIos", () => {
  it("knows an iPhone, and an iPad that says it's a Mac", () => {
    expect(isIos(IPHONE, 5)).toBe(true)
    expect(isIos(MAC, 5)).toBe(true)
    expect(isIos(MAC, 0)).toBe(false)
  })
})

describe("getPushState", () => {
  it("asks for the home screen in an iPhone Safari tab", async () => {
    stubBrowser({ push: false, userAgent: IPHONE, touch: 5 })
    expect(await getPushState()).toBe("needs-home-screen")
  })

  it("reads denied, off and on from the browser", async () => {
    stubBrowser({ permission: "denied" })
    expect(await getPushState()).toBe("denied")
    stubBrowser({ permission: "granted" })
    expect(await getPushState()).toBe("off")
    stubBrowser({ permission: "granted", subscription: subscription() })
    expect(await getPushState()).toBe("on")
  })
})

describe("resyncPush and turnPushOff", () => {
  it("sends the subscription with the device's timezone", async () => {
    stubBrowser({ permission: "granted", subscription: subscription() })
    await resyncPush()
    expect(api.registerPushSubscription).toHaveBeenCalledWith({
      endpoint: "https://push.example/a",
      keys: { p256dh: "k", auth: "a" },
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  })

  it("tells the api first, and unsubscribes even if that fails", async () => {
    const sub = subscription()
    stubBrowser({ permission: "granted", subscription: sub })
    api.removePushSubscription.mockRejectedValueOnce(new Error("offline"))
    await expect(turnPushOff()).rejects.toThrow("offline")
    expect(api.removePushSubscription).toHaveBeenCalledWith(sub.endpoint)
    expect(sub.unsubscribe).toHaveBeenCalled()
  })
})
