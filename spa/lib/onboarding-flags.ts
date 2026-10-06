"use client"

import { useSyncExternalStore } from "react"
import { featureFlags } from "@/lib/feature-flags"

// #482: the new onboarding is four compile-time flags (`featureFlags`), on in
// the full profile only. While we test it, a device can turn them on at runtime
// instead: one switch in settings, "new onboarding". Device-only: one
// localStorage key, never sent to the backend.
//
// On, the flags below read as on, whatever the build profile. Off, the build
// profile decides, as before. `featureFlags` itself is never changed: every
// reader of these flags goes through `useOnboardingFlags` (components) or
// `getOnboardingFlags` (plain functions on the client), so they all see the
// same value, the auth gate's signed-out check on "/" included.
//
// Same storage pattern as the mobile gate (`mobile-gate.ts`): every storage
// call is wrapped, because localStorage can be missing or throw (private
// windows, blocked site data). Then `memory` keeps the choice for the rest of
// the session. The server and the hydration render can't see the device, so
// they get `decided: false` and the build profile's flags: whoever would act
// on a flag (the auth gate) waits for `decided`, so nothing flashes.

export const NEW_ONBOARDING_KEY = "sponti.new-onboarding.v1"

const ON = "on"

/** The flags the switch turns on. A new onboarding flag is one more name. */
const ONBOARDING_FLAG_NAMES = [
  "browseBeforeSignup",
  "introV2",
  "locationAsk",
] as const

export type OnboardingFlags = Record<
  (typeof ONBOARDING_FLAG_NAMES)[number],
  boolean
>

export type ResolvedOnboardingFlags = OnboardingFlags & {
  /** False on the server and during hydration: the device isn't known yet. */
  decided: boolean
}

function buildFlags(): OnboardingFlags {
  const flags = {} as OnboardingFlags
  for (const name of ONBOARDING_FLAG_NAMES) flags[name] = !!featureFlags[name]
  return flags
}

/** The flags, given the build profile's and this device's switch. */
export function resolveOnboardingFlags(
  build: OnboardingFlags,
  override: boolean
): OnboardingFlags {
  if (!override) return build
  const flags = {} as OnboardingFlags
  for (const name of ONBOARDING_FLAG_NAMES) flags[name] = true
  return flags
}

let memory: boolean | undefined
const listeners = new Set<() => void>()

/** Whether this device has switched the new onboarding on. */
export function readNewOnboarding(): boolean {
  if (memory !== undefined) return memory
  try {
    return window.localStorage.getItem(NEW_ONBOARDING_KEY) === ON
  } catch {
    return false
  }
}

export function setNewOnboarding(on: boolean): void {
  memory = on
  try {
    if (on) window.localStorage.setItem(NEW_ONBOARDING_KEY, ON)
    else window.localStorage.removeItem(NEW_ONBOARDING_KEY)
  } catch {
    // Not stored: the choice lasts until the page is reloaded.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== NEW_ONBOARDING_KEY) return
    memory = undefined
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

// useSyncExternalStore compares snapshots by reference, so an unchanged
// result is the same object as the last one.
function stable(
  previous: ResolvedOnboardingFlags | undefined,
  next: ResolvedOnboardingFlags
): ResolvedOnboardingFlags {
  const same =
    previous &&
    previous.decided === next.decided &&
    ONBOARDING_FLAG_NAMES.every((name) => previous[name] === next[name])
  return same ? previous : next
}

let clientSnapshot: ResolvedOnboardingFlags | undefined
let serverSnapshot: ResolvedOnboardingFlags | undefined

function getSnapshot(): ResolvedOnboardingFlags {
  clientSnapshot = stable(clientSnapshot, {
    ...resolveOnboardingFlags(buildFlags(), readNewOnboarding()),
    decided: true,
  })
  return clientSnapshot
}

function getServerSnapshot(): ResolvedOnboardingFlags {
  serverSnapshot = stable(serverSnapshot, { ...buildFlags(), decided: false })
  return serverSnapshot
}

/**
 * The new-onboarding flags for this device. Read these, never `featureFlags`,
 * for the flags above. `decided` is false on the server and during hydration;
 * wait for it before acting on a flag (redirecting, say), and render a plain
 * background meanwhile.
 */
export function useOnboardingFlags(): ResolvedOnboardingFlags {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The same flags for code that isn't a component. Client only. */
export function getOnboardingFlags(): OnboardingFlags {
  return resolveOnboardingFlags(buildFlags(), readNewOnboarding())
}

/** The switch itself, for the settings page. False on the server. */
export function useNewOnboarding(): boolean {
  return useSyncExternalStore(subscribe, readNewOnboarding, () => false)
}

/** Test seam: forget the in-memory choice so storage is read again. */
export function resetNewOnboardingMemory(): void {
  memory = undefined
}
