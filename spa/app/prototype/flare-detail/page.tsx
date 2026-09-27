"use client"

// PROTOTYPE (#162) — throwaway route, NOT production.
// Question: what should the flare detail page look like?
// Three structurally different layouts of /event/[id], on local mock data,
// switchable via ?variant=A|B|C, with ?viewer=host|joined|invited and
// ?timing=live|upcoming. ?bar=0 hides the prototype bar (for screenshots).
// Once the team picks a layout: record the verdict on #162, delete this
// folder, and rebuild the winner properly in app/event/[id] (#139 first).

import { Suspense, useState, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import { buildFlare, type Timing, type Viewer } from "./_mock"
import { PrototypeBar, VARIANTS, type VariantKey, type VariantProps } from "./_shared"
import { VariantA } from "./_variant-a"
import { VariantB } from "./_variant-b"
import { VariantC } from "./_variant-c"

const COMPONENTS: Record<VariantKey, (p: VariantProps) => React.ReactNode> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
}

export default function FlareDetailPrototypePage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        prototypes are only available in development.
      </p>
    )
  }
  return (
    <Suspense>
      <Prototype />
    </Suspense>
  )
}

// A clock that ticks every 30s, and is null on the server so the
// time-relative mock data never causes a hydration mismatch.
const TICK = 30_000
function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, TICK)
  return () => window.clearInterval(id)
}
const clockSnapshot = () => Math.floor(Date.now() / TICK) * TICK
const serverClockSnapshot = () => null

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const { showActionFeedback } = useActionFeedback()
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, serverClockSnapshot)

  const variant = pick(params.get("variant"), VARIANTS.map((v) => v.key), "A")
  const viewer = pick<Viewer>(params.get("viewer"), ["host", "joined", "invited"], "invited")
  const timing = pick<Timing>(params.get("timing"), ["live", "upcoming"], "live")
  const showBar = params.get("bar") !== "0"

  const [myEta, setMyEta] = useState(15)
  const [plusOne, setPlusOne] = useState(false)

  const update = (next: Partial<{ variant: VariantKey; viewer: Viewer; timing: Timing }>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) sp.set(k, v)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }

  if (now === null) return null

  const flare = buildFlare(viewer, timing, myEta, now)
  const Variant = COMPONENTS[variant]

  return (
    <div
      className="min-h-dvh bg-background"
      // Height of the app's bottom nav, so sticky action bars sit above it.
      style={{ "--nav-h": "68px" } as React.CSSProperties}
    >
      {showBar && (
        <PrototypeBar variant={variant} viewer={viewer} timing={timing} onChange={update} />
      )}
      <Variant
        key={`${variant}-${viewer}-${timing}`}
        flare={flare}
        viewer={viewer}
        now={now}
        myEta={myEta}
        plusOne={plusOne}
        onEtaChange={setMyEta}
        onPlusOneChange={setPlusOne}
        onJoin={() => {
          showActionFeedback("you're in")
          update({ viewer: "joined" })
        }}
        onLeave={() => {
          showActionFeedback("not this one")
          update({ viewer: "invited" })
        }}
        onStub={(what) => showActionFeedback(`prototype: ${what}`)}
      />
    </div>
  )
}
