"use client"

// #640 (behind `webPush`): the soft ask for push, once per device, after the
// first flare someone lights here, when the lighting takeover has handed over.
// The browser's own prompt only comes after "turn on". On iPhone in a Safari
// tab push needs the home-screen app, so this stays quiet there (#641 offers
// the home-screen step instead).

import { useEffect, useState } from "react"
import { Drawer } from "vaul"
import { BellIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
import { subscribeToLitFlare, subscribeToLitPinRelease } from "@/lib/lit-flare"
import {
  getPushState,
  markPushAskSeen,
  pushAskSeen,
  turnPushOn,
} from "@/lib/push"

export const PUSH_ASK_TITLE = "want to know when someone joins?"

// After the takeover hands the pin over to the map, a beat before asking.
const ASK_DELAY_MS = 1200

export function PushAsk() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let timer: number | undefined
    const offer = () => {
      if (pushAskSeen()) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void getPushState().then((state) => {
          if (state !== "off" || pushAskSeen()) return
          markPushAskSeen()
          setOpen(true)
        })
      }, ASK_DELAY_MS)
    }
    const offLit = subscribeToLitFlare((_event, { held }) => {
      if (!held) offer()
    })
    const offRelease = subscribeToLitPinRelease(offer)
    return () => {
      offLit()
      offRelease()
      window.clearTimeout(timer)
    }
  }, [])

  const turnOn = async () => {
    haptic("medium")
    setBusy(true)
    try {
      await turnPushOn()
    } catch (err) {
      console.error("[Sponti] couldn't turn push on", err)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-foreground/20" />
        <Drawer.Content
          aria-label="push"
          data-sheet="push-ask"
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-(--shadow-sheet) outline-none"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border" />
          <Drawer.Title className="text-base font-semibold">
            {PUSH_ASK_TITLE}
          </Drawer.Title>
          <Drawer.Description className="mt-1 text-sm text-muted-foreground">
            only when someone joins, invites you or wants to connect.
          </Drawer.Description>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void turnOn()}
            className="mt-4 h-12 w-full rounded-full bg-accent text-sm text-accent-foreground hover:bg-accent/90"
          >
            <BellIcon className="size-4" />
            turn on
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 h-11 w-full text-sm text-muted-foreground"
          >
            not now
          </button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
