"use client"

// PROTOTYPE (#563), throwaway route, NOT production.
// Question: how do precise idea spots (the actual ping-pong table, wall or
// court) show close around the person's own position on the home map, and
// should they cycle? Four takes on real OpenStreetMap spots around
// humboldthain (see _spots.ts), switchable with ?take=a|b|c|d, plus
// ?motion=reduce for the reduced-motion fallback and ?bar=0 to hide the
// switcher for screenshots. Once a take is picked: record it on #563, delete
// this folder, and build it for real.

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useActionFeedback } from "@/components/action-feedback"
import {
  Dock,
  FauxMap,
  HomeCtas,
  PrototypeBar,
  TAKES,
  TopBar,
  useStill,
  type TakeKey,
  type TakeProps,
} from "./_shared"
import type { NearSpot } from "./_spots"
import { TakeA } from "./_take-a"
import { TakeB } from "./_take-b"
import { TakeC } from "./_take-c"
import { TakeD } from "./_take-d"

const COMPONENTS: Record<TakeKey, (p: TakeProps) => React.ReactNode> = {
  a: TakeA,
  b: TakeB,
  c: TakeC,
  d: TakeD,
}

export default function NearbyIdeasPrototypePage() {
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

function Prototype() {
  const router = useRouter()
  const params = useSearchParams()
  const { showActionFeedback } = useActionFeedback()
  const take = (TAKES.find((t) => t.key === params.get("take"))?.key ??
    "a") as TakeKey
  const still = useStill(params.get("motion"))
  const Take = COMPONENTS[take]

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="fixed inset-0">
      <FauxMap>
        {/* key: a take switch restarts its timers and picks. */}
        <Take
          key={`${take}-${still}`}
          still={still}
          onLight={(spot: NearSpot) =>
            showActionFeedback(`composer: ${spot.title} at ${spot.place}`)
          }
        />
      </FauxMap>
      <TopBar />
      {params.get("bar") !== "0" && (
        <PrototypeBar
          take={take}
          still={still}
          onTake={(t) => set("take", t)}
          onStill={(s) => set("motion", s ? "reduce" : null)}
        />
      )}
      <Dock>
        <HomeCtas />
      </Dock>
    </div>
  )
}
