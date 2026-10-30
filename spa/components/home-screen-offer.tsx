"use client"

// #641: offers the home screen sheet once per device, right after the person
// lights a flare: with the lighting takeover (#376) once it has handed over,
// otherwise a beat after the toast. Mounted by the authenticated app shell.
// Automatic on iPhone/iPad Safari only: there push is impossible without the
// home screen. Elsewhere the web push ask (#640) takes this moment, and
// Android's install button lives in notification settings. Nothing shows in
// the installed app, and it is offered once per device.

import { useEffect, useRef, useState } from "react"
import { HomeScreenSheet } from "@/components/home-screen-sheet"
import { featureFlags } from "@/lib/feature-flags"
import {
  hasOfferedHomeScreen,
  markHomeScreenOffered,
  useHomeScreen,
} from "@/lib/home-screen"
import {
  LIT_PIN_HOLD_MAX_MS,
  subscribeToLitFlare,
  subscribeToLitPinRelease,
} from "@/lib/lit-flare"

/** How long after the toast or the takeover's handover the sheet waits. */
export const OFFER_DELAY_MS = 1500

export function HomeScreenOffer() {
  const { mode } = useHomeScreen()
  const [open, setOpen] = useState(false)
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    if (!featureFlags.homeScreen) return
    const timers = new Set<ReturnType<typeof setTimeout>>()
    let stopRelease: (() => void) | undefined
    const show = () => {
      timers.add(
        setTimeout(() => {
          if (modeRef.current !== "ios" || hasOfferedHomeScreen()) return
          markHomeScreenOffered()
          setOpen(true)
        }, OFFER_DELAY_MS)
      )
    }
    const stopLit = subscribeToLitFlare((event, options) => {
      if (hasOfferedHomeScreen()) return
      if (!options.held) return show()
      // A held pin is under the takeover: wait for its handover.
      const fallback = setTimeout(show, LIT_PIN_HOLD_MAX_MS)
      timers.add(fallback)
      stopRelease = subscribeToLitPinRelease((id) => {
        if (id !== event.id) return
        clearTimeout(fallback)
        stopRelease?.()
        show()
      })
    })
    return () => {
      stopLit()
      stopRelease?.()
      timers.forEach(clearTimeout)
    }
  }, [])

  return <HomeScreenSheet open={open} onClose={() => setOpen(false)} />
}
