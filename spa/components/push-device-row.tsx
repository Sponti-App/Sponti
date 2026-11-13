"use client"

// #640: the "push on this device" switch in notification settings. Push is per
// device (each browser or home-screen app subscribes on its own), so this is
// not a stored setting: it reads the browser's state and changes it.

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { useActionFeedback } from "@/components/action-feedback"
import {
  getPushState,
  turnPushOff,
  turnPushOn,
  type PushState,
} from "@/lib/push"

const WHY_NOT: Partial<Record<PushState, string>> = {
  unsupported: "not available in this browser",
  "needs-home-screen": "add sponti to your home screen first",
  denied: "blocked in your browser's site settings",
}

export function PushDeviceRow() {
  const { showActionFeedback } = useActionFeedback()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getPushState().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async (on: boolean) => {
    setBusy(true)
    try {
      if (on) {
        setState(await turnPushOn())
      } else {
        await turnPushOff()
        setState("off")
      }
    } catch (err) {
      console.error("[Sponti] couldn't change push", err)
      showActionFeedback("couldn't change that", { tone: "error" })
      setState(await getPushState())
    } finally {
      setBusy(false)
    }
  }

  const reason = state ? WHY_NOT[state] : undefined

  return (
    <div
      data-push-state={state ?? "loading"}
      className="flex items-center justify-between rounded-xl border border-border p-3"
    >
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm font-medium">push on this device</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {reason ?? "joins, invites and friend requests"}
        </p>
      </div>
      <Switch
        aria-label="push on this device"
        checked={state === "on"}
        disabled={busy || state === null || Boolean(reason)}
        onCheckedChange={(v) => void toggle(v)}
      />
    </div>
  )
}
