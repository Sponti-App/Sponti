"use client"

import { useSyncExternalStore } from "react"
import { featureFlags } from "@/lib/feature-flags"

// #467 part 2: sponti is made for phones, so a desktop-sized screen without
// touch gets a calm notice with a QR code to open the page on a phone. The
// notice sits in the app itself, because people also arrive through invite and
// QR links, not only through the landing page.
//
// WARN OR BLOCK: this one constant is the choice. "warn" shows a "continue
// anyway" button that is remembered per device (the team still tests on
// desktop). "block" removes the button and ignores any remembered choice, so a
// desktop visitor only gets the QR. Flip it here, nowhere else.
export type MobileGateMode = "warn" | "block"
export const MOBILE_GATE_MODE: MobileGateMode = "warn"

export const MOBILE_GATE_KEY = "sponti.mobile-gate.v1"
const CONTINUE = "continue"

// A fine pointer with hover and a wide viewport: a desktop or laptop. Phones
// and tablets report a coarse pointer, and a narrowed desktop window stays on
// the app. Feature detection, not user-agent sniffing.
export const DESKTOP_QUERY =
  "(hover: hover) and (pointer: fine) and (min-width: 900px)"

/** "undecided" is the server render and the first client render. */
export type MobileGateState = "undecided" | "notice" | "app"

/** The decision, given what the device is and what it remembers. */
export function decideMobileGate({
  isDesktop,
  continued,
  mode = MOBILE_GATE_MODE,
}: {
  isDesktop: boolean
  continued: boolean
  mode?: MobileGateMode
}): "notice" | "app" {
  if (!isDesktop) return "app"
  if (mode === "warn" && continued) return "app"
  return "notice"
}

let memory: boolean | undefined
const listeners = new Set<() => void>()

function readContinued(): boolean {
  if (memory !== undefined) return memory
  try {
    return window.localStorage.getItem(MOBILE_GATE_KEY) === CONTINUE
  } catch {
    return false
  }
}

/** "continue anyway": don't show the notice again on this device. */
export function rememberContinueAnyway(): void {
  memory = true
  try {
    window.localStorage.setItem(MOBILE_GATE_KEY, CONTINUE)
  } catch {
    // Not stored: `memory` carries it until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(DESKTOP_QUERY)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== MOBILE_GATE_KEY) return
    memory = undefined
    listener()
  }
  listeners.add(listener)
  media.addEventListener("change", listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener("change", listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getSnapshot(): MobileGateState {
  if (!featureFlags.mobileGate) return "app"
  return decideMobileGate({
    isDesktop: window.matchMedia(DESKTOP_QUERY).matches,
    continued: readContinued(),
  })
}

function getServerSnapshot(): MobileGateState {
  return "undecided"
}

/**
 * What the gate shows. "undecided" on the server and during hydration, so
 * neither the app nor the notice flashes before the client has looked at the
 * device. Off (`mobileGate`), it is "app" straight away.
 */
export function useMobileGate(): MobileGateState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
