"use client"

// Thin wrapper around @capacitor/haptics with a web fallback. In the native
// app it uses Capacitor; in a browser it falls back to navigator.vibrate
// (Android Chrome). iPhone Safari has no vibration API, so there it stays
// silent. Import `haptic` from here instead of calling Capacitor directly so
// the web build never throws and the call sites stay clean.
//
// Usage:
//   haptic("selection")   — light tick (tab switch, snap point)
//   haptic("light")       — subtle impact (recenter, dismiss)
//   haptic("medium")      — standard impact (map marker tap, card swipe)
//   haptic("success")     — positive notification (join flare, RSVP)
//   haptic("warning")     — cautionary notification (leave flare)
//   haptic("error")       — error notification

import { Capacitor } from "@capacitor/core"

type HapticStyle =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error"

// Short vibration patterns (ms) per style for the web fallback. Arrays are
// vibrate/pause/vibrate; kept brief so they read as taps, not buzzes.
const WEB_PATTERNS: Record<HapticStyle, number | number[]> = {
  selection: 5,
  light: 10,
  medium: 20,
  heavy: 35,
  success: [15, 40, 15],
  warning: [25, 50, 25],
  error: [40, 40, 40, 40, 40],
}

function webVibrate(style: HapticStyle) {
  try {
    if (typeof navigator === "undefined") return
    if (typeof navigator.vibrate !== "function") return
    navigator.vibrate(WEB_PATTERNS[style])
  } catch {
    // Vibration may be blocked (no user activation, permissions policy) — fail silently.
  }
}

let _haptics: typeof import("@capacitor/haptics") | null = null

async function getHaptics() {
  if (_haptics) return _haptics
  try {
    _haptics = await import("@capacitor/haptics")
    return _haptics
  } catch {
    return null
  }
}

export async function haptic(style: HapticStyle = "selection"): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    webVibrate(style)
    return
  }

  const h = await getHaptics()
  if (!h) return

  const { Haptics, ImpactStyle, NotificationType } = h

  try {
    switch (style) {
      case "selection":
        await Haptics.selectionChanged()
        break
      case "light":
        await Haptics.impact({ style: ImpactStyle.Light })
        break
      case "medium":
        await Haptics.impact({ style: ImpactStyle.Medium })
        break
      case "heavy":
        await Haptics.impact({ style: ImpactStyle.Heavy })
        break
      case "success":
        await Haptics.notification({ type: NotificationType.Success })
        break
      case "warning":
        await Haptics.notification({ type: NotificationType.Warning })
        break
      case "error":
        await Haptics.notification({ type: NotificationType.Error })
        break
    }
  } catch {
    // Haptics may be unavailable on some device/OS combos — fail silently.
  }
}
