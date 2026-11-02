"use client"

import { useCallback, useSyncExternalStore } from "react"
import { featureFlags } from "@/lib/feature-flags"

// #641: "add sponti to your home screen". The home-screen app is where web
// push works on iPhone (#640) and opens like a real app, so testers are asked
// once, after their first flare, and can find it again in notification
// settings. Device-only: nothing is sent to the backend.
//
// What each browser can do:
//   iPhone/iPad Safari: no prompt API, so the sheet shows the steps ("ios").
//   Android Chrome: `beforeinstallprompt` hands us a prompt we call on a tap
//     ("prompt"). It can fire before any component mounts, so
//     `captureInstallPrompt` runs from the root layout.
//   Already installed, desktop, other browsers: nothing to offer ("none").

export type HomeScreenMode = "ios" | "prompt" | "none"

export type HomeScreenEnv = {
  userAgent: string
  maxTouchPoints: number
  /** Opened from the home screen already. */
  standalone: boolean
  /** A `beforeinstallprompt` is waiting. */
  hasPrompt: boolean
}

// Browsers on iOS that aren't Safari (their share menu differs) and in-app
// webviews (no share button for the page).
const IOS_NOT_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//

export function detectHomeScreenMode(env: HomeScreenEnv): HomeScreenMode {
  if (env.standalone) return "none"
  const { userAgent: ua } = env
  // iPadOS Safari reports "Macintosh" with a touch screen.
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && env.maxTouchPoints > 1)
  if (ios) return /Safari/.test(ua) && !IOS_NOT_SAFARI.test(ua) ? "ios" : "none"
  // Desktop Chrome fires the event too, but a desktop tab isn't the target.
  return env.hasPrompt && /Android/.test(ua) ? "prompt" : "none"
}

// ─── The deferred install prompt ────────────────────────────────────────────

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferred: InstallPromptEvent | null = null
let captured = false
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

/** Start listening for the install prompt. Idempotent; client only. */
export function captureInstallPrompt(): void {
  if (captured || typeof window === "undefined") return
  captured = true
  deferred =
    (window as Window & { __spontiInstallPrompt?: InstallPromptEvent })
      .__spontiInstallPrompt ?? null
  if (deferred) notify()
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for our own button instead of the browser's mini-infobar.
    event.preventDefault()
    deferred = event as InstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    notify()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function currentMode(): HomeScreenMode {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return detectHomeScreenMode({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
    hasPrompt: deferred !== null,
  })
}

/**
 * What this browser can offer: "ios" (show the steps), "prompt" (call
 * `install()`), or "none" (offer nothing; also on the server and during
 * hydration, and when the build has the home screen flag off). `install()`
 * shows the browser's prompt (once: the browser spends it).
 */
export function useHomeScreen(): {
  mode: HomeScreenMode
  install: () => Promise<"accepted" | "dismissed" | "unavailable">
} {
  const mode = useSyncExternalStore(
    subscribe,
    () => (featureFlags.homeScreen ? currentMode() : "none"),
    () => "none" as const
  )
  const install = useCallback(async () => {
    const prompt = deferred
    if (!prompt) return "unavailable" as const
    // A prompt can only be shown once, whatever the person answers.
    deferred = null
    notify()
    try {
      await prompt.prompt()
      return (await prompt.userChoice).outcome
    } catch {
      return "unavailable" as const
    }
  }, [])
  return { mode, install }
}

// ─── Offered once per device ────────────────────────────────────────────────

export const HOME_SCREEN_KEY = "sponti.home-screen.v1"

let offeredInMemory = false

/** The sheet was shown on this device (closed any way). */
export function hasOfferedHomeScreen(): boolean {
  if (offeredInMemory) return true
  try {
    return window.localStorage.getItem(HOME_SCREEN_KEY) === "offered"
  } catch {
    return false
  }
}

export function markHomeScreenOffered(): void {
  offeredInMemory = true
  try {
    window.localStorage.setItem(HOME_SCREEN_KEY, "offered")
  } catch {
    // Not stored: the memory flag lasts until the page is reloaded.
  }
}

/** Test seam. */
export function resetHomeScreenForTests(): void {
  offeredInMemory = false
  deferred = null
  captured = false
}
